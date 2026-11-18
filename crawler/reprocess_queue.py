"""Server-only idempotent reprocessor. All job modifications use ingest_job."""
import os
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from crawl_facebook import is_facebook_row, supabase
from refresh_facebook_existing import refresh_existing
from auto_cutoff import AUTO_CUTOFF
import pin_guard

def pipeline_version():
    root=Path(__file__).resolve().parent.parent
    files=["crawler/crawl_facebook.py","crawler/refresh_facebook_existing.py",
           "crawler/reprocess_queue.py","crawler/pin_guard.py","src/lib/jobDetailSections.ts",
           "src/lib/sourceRecruitmentRoles.ts","scripts/ocr/ocr-compare.mjs"]
    digest=hashlib.sha256()
    for path in files:
        digest.update(path.encode())
        digest.update((root/path).read_bytes())
    return "reprocess-"+digest.hexdigest()[:20]

VERSION = pipeline_version()
BATCH = 20

def enqueue(job_id, reason, version=VERSION):
    payload = {"job_id":job_id,"reason":reason,"rule_version":version}
    # Never erase prior success on repeat deploy.
    result = supabase.table("job_reprocess_queue").upsert(payload,on_conflict="job_id,rule_version",ignore_duplicates=True).execute()
    return result.data

def enqueue_affected():
    # Only source-backed Facebook jobs; no arbitrary origin or human-entered data.
    offset = 0
    while True:
        # Lee 2026-11-01: 규칙이 바뀌어도 기존 공고(기준 시각 전)는 다시 처리하지 않는다. 직접 지정한 번호만 예외.
        rows = (supabase.table("local_jobs").select("id,description,source_url")
                .eq("origin","crawler").gte("created_at",AUTO_CUTOFF).order("id").range(offset,offset+199).execute().data or [])
        for job in rows:
            if is_facebook_row(job):
                enqueue(job["id"],"facebook_rules_changed")
        if len(rows) < 200: break
        offset += 200

def run():
    if supabase is None: raise RuntimeError("Supabase server credentials missing")
    # A runner crash must not leave a job locked forever. Bounded automatic retries.
    cutoff=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat()
    stale=(supabase.table("job_reprocess_queue").select("id,attempts")
           .eq("status","running").lt("started_at",cutoff).limit(50).execute().data or [])
    for item in stale:
        target="pending" if item["attempts"] < 3 else "failed"
        supabase.table("job_reprocess_queue").update({"status":target,"error":"worker_timeout"}).eq("id",item["id"]).eq("status","running").execute()
    if os.environ.get("REPROCESS_ENQUEUE_ALL") == "1": enqueue_affected()
    ids = [int(x) for x in os.environ.get("REPROCESS_JOB_IDS","").split(",") if x.strip().isdigit()]
    for job_id in ids: enqueue(job_id,"explicit_validation")
    rows = (supabase.table("job_reprocess_queue").select("id,job_id,attempts")
            .eq("status","pending").order("requested_at").limit(BATCH).execute().data or [])
    failures = 0
    for item in rows:
        key = item["id"]
        # Guard against concurrent schedulers claiming the same queue item.
        claimed = supabase.table("job_reprocess_queue").update({
            "status":"running","attempts":item["attempts"]+1,
            "started_at":datetime.now(timezone.utc).isoformat()
        }).eq("id",key).eq("status","pending").execute().data
        if not claimed: continue
        try:
            # 다시 처리 전 핀을 적어 두고 마무리 단계(finalize)에서 비교한다(pin_guard, 2026-11-12).
            pins_before = pin_guard.snapshot(supabase, item["job_id"])
            # 재처리 전 공개 상태·이미지 개수도 적어 둔다 — 마무리 단계가 '재처리가 공개를 내렸는가'를 가린다(DB 구조 변경 없음, result에만).
            row_before = (supabase.table("local_jobs").select("active,admin_hidden,images")
                          .eq("id",item["job_id"]).single().execute().data) or {}
            before = {"active":row_before.get("active"),"admin_hidden":row_before.get("admin_hidden"),
                      "images":len(row_before["images"]) if isinstance(row_before.get("images"),list) else 0}
            refresh_existing(item["job_id"])
            current = (supabase.table("local_jobs")
                .select("id,title,active,publish_gate_reason,ocr_check")
                .eq("id",item["job_id"]).single().execute().data)
            result = {"title":current["title"],"active":current["active"],
                      "publish_gate_reason":current.get("publish_gate_reason"),
                      "r7":(current.get("ocr_check") or {}).get("status"),"pins_before":pins_before,"before":before}
            # Ingest success alone does not assert publication success.
            supabase.table("job_reprocess_queue").update({
                "status":"running","result":result
            }).eq("id",key).execute()
            print(json.dumps({"job_id":item["job_id"],**result},ensure_ascii=False))
        except Exception as exc:
            failures += 1
            supabase.table("job_reprocess_queue").update({
                "status":"failed","error":str(exc)[:1500],
                "finished_at":datetime.now(timezone.utc).isoformat()
            }).eq("id",key).execute()
            print(f"::error::job {item['job_id']} reprocess failed: {exc}")
    if failures: raise RuntimeError(f"{failures} reprocess jobs failed")

if __name__ == "__main__": run()

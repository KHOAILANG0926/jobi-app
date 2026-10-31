"""Server-only idempotent reprocessor. All job modifications use ingest_job."""
import os
import json
from datetime import datetime, timezone
from crawl_facebook import supabase
from refresh_facebook_existing import refresh_existing

VERSION = os.environ.get("REPROCESS_VERSION", "facebook-v1")
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
        rows = (supabase.table("local_jobs").select("id,description")
                .eq("origin","crawler").order("id").range(offset,offset+199).execute().data or [])
        for job in rows:
            if "[source:facebook]" in (job.get("description") or ""):
                enqueue(job["id"],"facebook_rules_changed")
        if len(rows) < 200: break
        offset += 200

def run():
    if supabase is None: raise RuntimeError("Supabase server credentials missing")
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
            refresh_existing(item["job_id"])
            current = (supabase.table("local_jobs")
                .select("id,title,active,publish_gate_reason,ocr_check")
                .eq("id",item["job_id"]).single().execute().data)
            result = {"title":current["title"],"active":current["active"],
                      "publish_gate_reason":current.get("publish_gate_reason"),
                      "r7":(current.get("ocr_check") or {}).get("status")}
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

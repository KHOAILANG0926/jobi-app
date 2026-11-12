#!/usr/bin/env python3
"""Refresh one existing Facebook job through the approved ingest_job gateway.
This never inserts another post or changes manual approval fields. Run on trusted
GitHub Actions with server-side Supabase credentials, never on a user's PC.
"""
import argparse
import json
import re
import unicodedata
from crawl_facebook import parse_post, supabase
import ingest_gateway
from pin_guard import merge_store_rows
from ingest_gateway import ingest_job

# 급여는 다시 수집이 쓰지 않는다(2026-11-01 Lee "읽는 규칙을 하나로" — src/lib/salaryReader.ts 한 곳).
FIELDS = ["title", "company", "location"]

def title_from_evidence(source_text: str, ocr_text: str, company: str) -> str:
    """Pick an evidenced recruitment headline, never a section heading or fabricated job name."""
    heading = re.compile(r"^(?:vị trí(?: tuyển dụng)?|cách nộp hồ sơ|địa (?:chỉ|điểm)(?: làm việc)?|thời gian(?: làm việc)?|lương|quyền lợi)\\s*[:：]?$", re.I)
    recruitment = re.compile(r"\\b(?:tìm đồng đội|tuyển dụng|cần tuyển|tuyển nhân viên|tuyển gấp)\\b", re.I)
    for evidence in (source_text, ocr_text):
        lines = [re.sub(r"^[^\\wÀ-ỹ]+|[^\\wÀ-ỹ]+$", "", line.strip()) for line in evidence.splitlines()]
        for line in lines:
            if 8 <= len(line) <= 120 and recruitment.search(line) and not heading.fullmatch(line):
                return line
    return ""




def refresh_existing(job_id: int):
    if supabase is None:
        raise RuntimeError("Supabase server configuration unavailable")
    response = (supabase.table("local_jobs")
                .select("id,origin,admin_hidden,source_text,ocr_text,source_url,description,images,location")
                .eq("id", job_id).single().execute())
    old = response.data or {}
    if old.get("origin") != "crawler" or old.get("admin_hidden"):
        raise RuntimeError("Cannot refresh a non-crawler or admin-hidden job")
    text = old.get("source_text") or ""
    # 2026-11-01: 상세요강은 원문에서 다시 만들어져 "[source:facebook]" 표시가 사라진다 → 원문 주소(source_url)로도 판단.
    from_facebook = "[source:facebook]" in (old.get("description") or "") or "facebook.com/" in (old.get("source_url") or "")
    if not text or not from_facebook:
        raise RuntimeError("Not a preserved Facebook source post")
    group_location = ""
    parsed = parse_post({"text": text, "location": group_location, "images": old.get("images") or []})
    backed_title = title_from_evidence(text, old.get("ocr_text") or "", parsed.get("company") or "")
    if backed_title:
        parsed["title"] = backed_title
    if not parsed["title"] or not parsed["company"] or parsed["title"].endswith(":"):
        raise RuntimeError("Parsed title or company is missing or is only a heading")
    # 원문 주소는 위치 확인 서버의 주소 읽기 한 곳(src/lib/addressReader.ts)으로 읽는다(Lee 2026-11-07, 지도 조회 없음).
    parsed["location"] = str((ingest_gateway.READ_LOCATION(text, parsed.get("location") or "") or {}).get("location") or "").strip()
    if not parsed.get("location"):
        raise RuntimeError("Cannot refresh location without a source-backed location")
    # 매장이 여러 곳이면(Lee 2026-11-11 KRIK·MediaMart) 새 공고와 같은 위치 확인으로 '찾은 매장'을 더한다(못 찾은 매장은 안 넣음, 절대 원칙).
    # 기존 근무지 줄은 그대로 둔다(Codex #705): DB 입구는 받은 목록으로 근무지를 바꾸고 빠진 줄은 지우므로, 기존 줄을 앞에 넣고
    # 새로 찾은 매장만 뒤에 붙인다. 확인 실패면 예전 동작(위치 글자만).
    rows = []
    try:
        verdict = ingest_gateway.PRECHECK({"company": parsed.get("company") or "", "location": "", "source_text": text}) or {}
        found = [str(x).strip() for x in (verdict.get("stores") or []) if str(x).strip()][:5]
        if verdict.get("findable") is True and found:
            existing = (supabase.table("job_work_locations")
                        .select("raw_address,lat,lng,location_verified,point_authority")
                        .eq("job_id", job_id).order("sort_order").execute()).data or []
            rows = merge_store_rows(existing, found)
            if rows and not existing:
                parsed["location"] = found[0]
    except Exception as exc:  # 위치 확인 서버 오류로 다시 처리를 막지 않는다(예전 동작 그대로)
        print(f"store precheck skipped: {type(exc).__name__}")
    # Source text is preserved. No user-written field value is applied.
    payload = {
        "channel": "crawler_facebook",
        "job_id": job_id,
        "refresh": True,
        "update_fields": FIELDS,
        "source": "facebook",
        "source_url": old.get("source_url"),
        "source_text": text,
        "images": old.get("images") or [],
        **{k: parsed[k] for k in FIELDS},
        **({"work_locations": rows} if rows else {}),
    }
    result = ingest_job(supabase, payload)
    if int(result) != job_id:
        raise RuntimeError(f"Unexpected job number returned: {result}")
    after = (supabase.table("local_jobs")
             .select("id,title,company,salary,location,active,admin_hidden")
             .eq("id", job_id).single().execute()).data
    if not after or after["id"] != job_id or after.get("admin_hidden"):
        raise RuntimeError("Refresh did not preserve existing job identity or admin protection")
    for key in FIELDS:
        if after.get(key) != parsed[key]:
            raise RuntimeError(f"Refresh not persisted for {key}: expected source-backed field")
    print("ingest_job persisted all source-backed fields for existing job", job_id)
    print(json.dumps({"job_id": job_id, "updated": {k: after[k] for k in FIELDS},
                      "active": after["active"]}, ensure_ascii=False))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--job-id", type=int, required=True)
    args = p.parse_args()
    refresh_existing(args.job_id)

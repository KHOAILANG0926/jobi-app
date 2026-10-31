#!/usr/bin/env python3
"""Refresh one existing Facebook job through the approved ingest_job gateway.
This never inserts another post or changes manual approval fields. Run on trusted
GitHub Actions with server-side Supabase credentials, never on a user's PC.
"""
import argparse
import json
from crawl_facebook import parse_post, supabase
from ingest_gateway import ingest_job

FIELDS = ["title", "company", "salary", "location"]

def refresh_existing(job_id: int):
    if supabase is None:
        raise RuntimeError("Supabase server configuration unavailable")
    response = (supabase.table("local_jobs")
                .select("id,origin,admin_hidden,source_text,source_url,description,images,location")
                .eq("id", job_id).single().execute())
    old = response.data or {}
    if old.get("origin") != "crawler" or old.get("admin_hidden"):
        raise RuntimeError("Cannot refresh a non-crawler or admin-hidden job")
    text = old.get("source_text") or ""
    if not text or "[source:facebook]" not in (old.get("description") or ""):
        raise RuntimeError("Not a preserved Facebook source post")
    group_location = ""
    parsed = parse_post({"text": text, "location": group_location, "images": old.get("images") or []})
    if not parsed["title"] or not parsed["company"] or parsed["title"].endswith(":"):
        raise RuntimeError("Parsed title or company is missing or is only a heading")
    if not parsed.get("location"):
        raise RuntimeError("Cannot refresh location without a source-backed location")
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
    print("ingest_job persisted all four source-backed fields for existing job", job_id)
    print(json.dumps({"job_id": job_id, "updated": {k: after[k] for k in FIELDS},
                      "active": after["active"]}, ensure_ascii=False))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--job-id", type=int, required=True)
    args = p.parse_args()
    refresh_existing(args.job_id)

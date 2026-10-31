"""Finalize queue only after independent OCR and publication gates have completed."""
import json
from datetime import datetime, timezone
from crawl_facebook import supabase

def run():
    queue=(supabase.table("job_reprocess_queue").select("id,job_id,result")
           .eq("status","running").order("started_at").limit(50).execute().data or [])
    failures=0
    for item in queue:
        current=(supabase.table("local_jobs").select(
            "id,title,active,admin_hidden,publish_gate_reason,ocr_check,occupation_code"
        ).eq("id",item["job_id"]).single().execute().data)
        r7=(current.get("ocr_check") or {}).get("status")
        title=current.get("title","").strip()
        title_ok=bool(title) and not title.endswith(":") and title.casefold()!="vị trí tuyển dụng:"
        published=current.get("active") is True and current.get("admin_hidden") is False
        ok=title_ok and r7=="ok" and published
        result={**(item.get("result") or {}),"title":title,"title_verified":title_ok,
                "r7":r7,"published":published,
                "url":f"https://viecganban.vn/viec-lam/sb-{item['job_id']}" if published else None}
        update={"status":"success" if ok else "blocked","result":result,
                "finished_at":datetime.now(timezone.utc).isoformat(),
                "error":None if ok else "title_or_r7_or_publish_gate_unverified"}
        supabase.table("job_reprocess_queue").update(update).eq("id",item["id"]).eq("status","running").execute()
        print(json.dumps({"job_id":item["job_id"],**update},ensure_ascii=False))
        if not ok: failures+=1
    if failures: raise RuntimeError(f"{failures} jobs failed title/R7/publication verification")

if __name__=="__main__": run()

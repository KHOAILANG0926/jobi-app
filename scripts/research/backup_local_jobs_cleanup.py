"""기존 크롤러 공고 정리 전 백업(읽기 전용 GET만, DB 쓰기 없음).

대상: local_jobs 중 #4682를 제외한 전부 + 연결된 job_work_locations / job_location_candidates / admin_audit_logs(target_id).
출력: backups/<UTC타임스탬프>/*.json + manifest.json(건수·sha256). backups/는 gitignore.
키: crawler/.env의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 두 줄만 읽는다. 키 값은 출력·파일·예외 메시지에 남기지 않는다.
실행: python scripts/research/backup_local_jobs_cleanup.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
KEEP_ID = 4682
PAGE = 500


def load_env() -> tuple[str, str]:
    vals = {}
    for line in (ROOT / "crawler" / ".env").read_text("utf-8").splitlines():
        for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            if line.startswith(k + "="):
                vals[k] = line.split("=", 1)[1].strip().strip("'\"")
    return vals["SUPABASE_URL"].rstrip("/"), vals["SUPABASE_SERVICE_ROLE_KEY"]


URL, KEY = load_env()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def get_all(table: str, params: dict) -> list[dict]:
    rows, off = [], 0
    while True:
        r = requests.get(f"{URL}/rest/v1/{table}", headers={**H, "Range-Unit": "items", "Range": f"{off}-{off + PAGE - 1}"},
                         params={**params, "order": "id.asc"}, timeout=60)
        if r.status_code not in (200, 206):
            raise RuntimeError(f"{table}: HTTP {r.status_code} {r.text[:200].replace(KEY, '[REDACTED]')}")
        part = r.json()
        rows += part
        if len(part) < PAGE:
            return rows
        off += PAGE


def main() -> None:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = ROOT / "backups" / ts
    out.mkdir(parents=True)
    jobs = get_all("local_jobs", {"select": "*", "id": f"neq.{KEEP_ID}"})
    ids = [j["id"] for j in jobs]
    idlist = ",".join(map(str, ids))
    tables = {
        "local_jobs": jobs,
        "job_work_locations": get_all("job_work_locations", {"select": "*", "job_id": f"in.({idlist})"}),
        "job_location_candidates": get_all("job_location_candidates", {"select": "*", "job_id": f"in.({idlist})"}),
        "admin_audit_logs": get_all("admin_audit_logs", {"select": "*", "target_type": "eq.job", "target_id": f"in.({idlist})"}),
    }
    # 참조 테이블은 0건이어야 한다(있으면 삭제하면 안 됨) — 건수만 기록
    refs = {}
    for t in ("applications", "interviews", "message_threads", "job_alert_notifications", "local_jobs_description_backup"):
        r = requests.get(f"{URL}/rest/v1/{t}", headers={**H, "Prefer": "count=exact"}, params={"select": "job_id", "job_id": f"in.({idlist})", "limit": "1"}, timeout=60)
        refs[t] = int(r.headers.get("content-range", "*/-1").split("/")[-1]) if r.status_code in (200, 206) else f"HTTP {r.status_code}"
    manifest = {"created_utc": ts, "keep_id": KEEP_ID, "job_ids": [min(ids), max(ids)], "counts": {}, "reference_counts": refs}
    for name, rows in tables.items():
        p = out / f"{name}.json"
        p.write_text(json.dumps(rows, ensure_ascii=False, indent=1, default=str), "utf-8")
        manifest["counts"][name] = {"rows": len(rows), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
    manifest["ids_sha256"] = hashlib.sha256(",".join(map(str, sorted(ids))).encode()).hexdigest()
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=1))
    print("dir:", out)


if __name__ == "__main__":
    main()

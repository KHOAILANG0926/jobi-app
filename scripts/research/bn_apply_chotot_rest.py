"""박닌 Chợ Tốt 채택 100건 → local_jobs + job_work_locations 반영 실행기(승인 후 실행 전용, batch 단위).

bn_prepare_chotot_insert.build_jobs()가 만든 값을 그대로 PostgREST로 보낸다(SQL batch 파일과 같은 데이터, 손으로 옮기지 않음).
- admin_hidden=true(비공개), source_url=NULL. 이미 같은 source('chotot:<광고번호>')가 있으면 건너뛴다(재실행 안전).
- 한 건이라도 오류가 나면 그 자리에서 멈춘다(이후 건은 시도하지 않음) — 남은 상태를 출력한다.
- 키는 crawler/.env의 두 줄만 읽고 어디에도 출력하지 않는다.
실행: python scripts/research/bn_apply_chotot_rest.py <batch번호 1..10>
기록: scripts/research/out/bn_chotot_applied.json(source → local_jobs.id)
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bn_prepare_chotot_insert as prep  # noqa: E402

ROOT = HERE.parents[1]
OUT = HERE / "out"
APPLIED = OUT / "bn_chotot_applied.json"


def load_env() -> tuple[str, str]:
    vals = {}
    for line in (ROOT / "crawler" / ".env").read_text("utf-8").splitlines():
        for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            if line.startswith(k + "="):
                vals[k] = line.split("=", 1)[1].strip().strip("'\"")
    return vals["SUPABASE_URL"].rstrip("/"), vals["SUPABASE_SERVICE_ROLE_KEY"]


URL, KEY = load_env()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def red(s: str) -> str:
    return str(s).replace(KEY, "[REDACTED]")


def post(table: str, body: dict) -> dict:
    r = requests.post(f"{URL}/rest/v1/{table}", headers={**H, "Prefer": "return=representation"}, data=json.dumps(body), timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"POST {table}: HTTP {r.status_code} {red(r.text[:400])}")
    return r.json()[0]


def main() -> None:
    n = int(sys.argv[1])
    jobs, errors = prep.build_jobs()
    if errors:
        raise SystemExit(f"validation errors, stop: {errors}")
    batch = jobs[(n - 1) * 10: n * 10]
    applied = json.loads(APPLIED.read_text("utf-8")) if APPLIED.exists() else {}
    done, skipped = [], []
    for j in batch:
        src = j["source"]
        r = requests.get(f"{URL}/rest/v1/local_jobs", headers=H, params={"select": "id", "source": f"eq.{src}"}, timeout=60)
        if r.status_code != 200:
            raise SystemExit(f"lookup failed: HTTP {r.status_code} {red(r.text[:200])}")
        if r.json():
            skipped.append(src)
            applied[src] = r.json()[0]["id"]
            continue
        row = {k: v for k, v in j.items() if not k.startswith("_")}
        try:
            created = post("local_jobs", row)
            loc = j["_loc"]
            post("job_work_locations", {
                "job_id": created["id"], "raw_address": loc["raw_address"], "country": "VN", "province": "Bắc Ninh",
                "geocode_status": "pending", "location_verified": False, "sort_order": 0,
                "address_accuracy": loc["address_accuracy"], "coordinate_accuracy": "unresolved",
                "matched_recruitment_regions": ["Bắc Ninh"], "resolved_province": "Bắc Ninh", "industrial_park": loc["industrial_park"],
            })
        except Exception as e:  # 한 건 실패하면 멈춘다
            APPLIED.write_text(json.dumps(applied, indent=1), "utf-8")
            raise SystemExit(f"STOP at {src}: {red(e)} | done so far in this batch: {done}")
        applied[src] = created["id"]
        done.append(created["id"])
    APPLIED.write_text(json.dumps(applied, indent=1), "utf-8")
    line = "\n".join(sorted(f"{j['source']}|{j['company']}|{j['employer_phone']}|{j['salary'] or ''}" for j in batch))
    print(json.dumps({"batch": n, "inserted": len(done), "skipped_existing": len(skipped), "ids": sorted(done),
                      "id_range": [min(done), max(done)] if done else None,
                      "check_md5": hashlib.md5(line.encode()).hexdigest()}, ensure_ascii=False))


if __name__ == "__main__":
    main()

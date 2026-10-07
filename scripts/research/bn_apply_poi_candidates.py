"""chotot 좌표 후보 dry-run 결과 → job_location_candidates(status='pending') 반영. 기본은 dry-run, --apply일 때만 쓴다.

입력: scripts/research/out/chotot_poi_candidates.json(bn_poi_match.mjs 산출) — 상태가 '자동 승인 후보'·'검토 필요'인 공고의 1순위 후보 1건씩.
정책(사용자 승인 2026-10-07): 후보 좌표·출처 id·일치 근거를 함께 저장, job_work_locations의 좌표는 건드리지 않는다(승인 전 핀 표시 없음).
 - status='pending'(기본), source='map_listing'(지도 POI), place_precision: POI='building', OSM 면='site', KCN 자체(이름이 'Khu công nghiệp/KCN'로 시작)='area'(area는 승인 불가 제약 → 검토용 참고).
 - evidence에는 경쟁 채용 사이트 이름·링크·광고 좌표를 쓰지 않는다. evidence_urls는 비운다.
 - 같은 공고·같은 주소에 30 m 안 후보가 이미 있으면 건너뛴다(재실행 안전).
키: crawler/.env(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)만 읽고 출력하지 않는다.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "scripts" / "research" / "out"
APPLY = "--apply" in sys.argv


def load_env() -> tuple[str, str]:
    vals = {}
    for line in (ROOT / "crawler" / ".env").read_text("utf-8").splitlines():
        for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            if line.startswith(k + "="):
                vals[k] = line.split("=", 1)[1].strip().strip("'\"")
    return vals["SUPABASE_URL"].rstrip("/"), vals["SUPABASE_SERVICE_ROLE_KEY"]


URL, KEY = load_env()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def red(s) -> str:
    return str(s).replace(KEY, "[REDACTED]")


def dist(a, b, c, d) -> float:
    r = 6371008.8
    x, y = math.radians(c - a), math.radians(d - b)
    h = math.sin(x / 2) ** 2 + math.cos(math.radians(a)) * math.cos(math.radians(c)) * math.sin(y / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def tile15(lat: float, lng: float) -> str:
    n = 2 ** 15
    return f"{int((lng + 180) / 360 * n)}/{int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)}"


def get(table: str, params: dict) -> list[dict]:
    r = requests.get(f"{URL}/rest/v1/{table}", headers=H, params=params, timeout=60)
    if r.status_code != 200:
        raise SystemExit(f"GET {table}: HTTP {r.status_code} {red(r.text[:200])}")
    return r.json()


def reason_vi(row: dict) -> str:
    """관리자 화면이 베트남어라 dry-run 사유를 베트남어로 옮긴다."""
    r, st = row["reason"], row["status"]
    if st == "자동 승인 후보":
        return "tên khớp chính xác + vị trí phù hợp (đề xuất tự động, vẫn cần duyệt)"
    if "정확히 같지만" in r:
        m = re.search(r"가장 가까운 (\d+) m", r)
        return f"tên khớp chính xác nhưng vị trí xa tin ({m.group(1) if m else '?'} m)"
    if "포함됨" in r:
        return "tên công ty nằm trong tên POI (chưa chính xác)"
    if "비슷한" in r:
        return "chỉ có ứng viên tên gần giống — dễ nhầm, cần kiểm tra kỹ"
    return "cần kiểm tra"


def build(row: dict, cand: dict, loc: dict) -> dict:
    name, cls, src = cand["name"], cand.get("cls") or "—", cand["src"]
    is_area = bool(re.match(r"^(khu c[oô]ng nghi[eệ]p|kcn)\b", name, re.I)) if name else False
    precision = "area" if is_area else ("site" if src == "osm" else "building")
    if cand.get("exact"):
        match = "tên khớp chính xác"
    elif cand.get("cont"):
        match = "tên công ty nằm trong tên POI (chưa chính xác)"
    else:
        match = f"tên tương tự {round(cand['sim'] * 100)}% (chỉ gần giống)"
    if src == "vietmap":
        ref = f"VietMap POI (ô vector z15 {tile15(cand['lat'], cand['lng'])}): {name} @ {cand['lat']:.6f},{cand['lng']:.6f} · loại {cls}"
        origin = "VietMap tile POI"
    else:
        ref = f"OpenStreetMap {cand.get('ref', '—')} · {name} · loại {cls}"
        origin = "OpenStreetMap"
    evidence = "\n".join([
        f"[Tự động · dry-run 07/10/2026] {origin}: {name}",
        f"Độ khớp: {match} · kết quả dry-run: {'đề xuất tự động' if row['status'] == '자동 승인 후보' else 'cần kiểm tra'} — {reason_vi(row)}",
        f"Tên công ty trong tin: {row['company']}",
        f"Khoảng cách tới vị trí ước lượng (cấp phường/xã/KCN) của tin: {cand['d']} m · Trong ranh KCN: {'có' if cand.get('inside') else 'không/chưa xác định'}"
        + (f" · Còn {row.get('n_cands', 1) - 1} ứng viên khác" if row.get('n_cands', 1) > 1 else ""),
        f"Mã nguồn: {ref}",
        "Chưa duyệt: cần quản trị viên đối chiếu trên bản đồ/vệ tinh trước khi dùng." + (" (Đây là cả khu công nghiệp, không phải nhà máy cụ thể — chỉ tham khảo.)" if is_area else ""),
    ])
    return {
        "job_id": row["jid"], "work_location_id": loc["id"], "company_snapshot": row["company"], "address_snapshot": loc["raw_address"],
        "lat": cand["lat"], "lng": cand["lng"], "place_precision": precision, "source": "map_listing", "evidence": evidence,
        "evidence_urls": [], "status": "pending",
    }


def main() -> None:
    rows = json.loads((OUT / "chotot_poi_candidates.json").read_text("utf-8"))
    target = [r for r in rows if r["status"] in ("자동 승인 후보", "검토 필요") and r["cands"]]
    ids = ",".join(str(r["jid"]) for r in target)
    locs = {}
    for l in get("job_work_locations", {"select": "id,job_id,raw_address,lat,lng", "job_id": f"in.({ids})"}):
        locs.setdefault(l["job_id"], l)
    existing = {}
    for c in get("job_location_candidates", {"select": "job_id,address_snapshot,lat,lng", "job_id": f"in.({ids})"}):
        existing.setdefault(c["job_id"], []).append(c)
    made, skipped, problems = [], [], []
    for r in target:
        loc = locs.get(r["jid"])
        if not loc or not (loc.get("raw_address") or "").strip():
            problems.append((r["jid"], "work location 없음")); continue
        cand = r["cands"][0]
        r["n_cands"] = len(r["cands"])
        if any(dist(cand["lat"], cand["lng"], e["lat"], e["lng"]) < 30 and e["address_snapshot"] == loc["raw_address"] for e in existing.get(r["jid"], [])):
            skipped.append(r["jid"]); continue
        payload = build(r, cand, loc)
        made.append(payload)
        if APPLY:
            res = requests.post(f"{URL}/rest/v1/job_location_candidates", headers={**H, "Prefer": "return=representation"}, data=json.dumps(payload), timeout=60)
            if res.status_code not in (200, 201):
                raise SystemExit(f"STOP at job {r['jid']}: HTTP {res.status_code} {red(res.text[:300])} | saved so far: {len(made) - 1}")
    prec = {}
    for p in made:
        prec[p["place_precision"]] = prec.get(p["place_precision"], 0) + 1
    print(json.dumps({"mode": "APPLY" if APPLY else "DRY-RUN", "targets": len(target), "to_insert": len(made), "skipped_existing": len(skipped), "problems": problems,
                      "precision": prec, "by_status": {s: sum(1 for r in target if r["status"] == s) for s in ("자동 승인 후보", "검토 필요")},
                      "work_location_coords_untouched": all(loc.get("lat") is None and loc.get("lng") is None for loc in locs.values())}, ensure_ascii=False))
    if made and not APPLY:
        print("sample evidence:\n" + made[0]["evidence"])


if __name__ == "__main__":
    main()

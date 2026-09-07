"""job_work_locations 좌표 재지오코딩 CLI.

2026-09-07 사용자 지시로 신설 — crawl_topcv.py는 크롤링 당시 딱 한 번만
지오코딩을 시도하고(region_only 텍스트는 애초에 시도조차 하지 않고
'pending'으로 건너뜀), 이후 실패/보류 상태를 별도로 재처리할 방법이
없었다. 이 스크립트가 그 재처리 전용 경로 — job_work_locations 테이블만
직접 대상으로 하며, local_jobs/크롤링 파이프라인은 건드리지 않는다.

기본 동작은 항상 dry-run이다: geocode_cache를 읽기만 하고(Geoapify API
호출 없음), job_work_locations에도 아무것도 쓰지 않는다. 실제로 API를
부르고 DB를 갱신하려면 --apply를 명시해야 한다.

사용 예:
  # 조건 방식(geocode_status 기준) — dry-run
  python3 regeocode_work_locations.py --geocode-status pending

  # ID 방식 — dry-run
  python3 regeocode_work_locations.py --regeocode-work-location-ids 101,102,103

  # 실제 처리(승인 후에만) — 최대 10건
  python3 regeocode_work_locations.py --geocode-status pending --apply --limit 10
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from geocode import peek_geocode_cache, resolve_coordinate_accuracy
from job_quality import classify_work_location_candidate, guess_province_from_text

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

SELECT_COLUMNS = (
    "id,job_id,raw_address,normalized_address,geocode_status,geocode_source,"
    "coordinate_accuracy,address_accuracy,province,district,lat,lng"
)


def fetch_target_rows(geocode_status: str | None, ids: list[int] | None, limit: int | None) -> list[dict]:
    """대상 행 조회 — 두 방식 중 정확히 하나만 써야 한다(ID 방식이 있으면
    ID 방식 우선, geocode_status는 무시). 항상 id 오름차순 — 같은 조건으로
    재실행해도 --limit이 매번 동일한 행 부분집합을 가리키게 하기 위함."""
    if not supabase:
        raise RuntimeError("Supabase 클라이언트 초기화 실패 — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 확인 필요")
    query = supabase.table("job_work_locations").select(SELECT_COLUMNS)
    if ids:
        query = query.in_("id", ids)
    elif geocode_status:
        query = query.eq("geocode_status", geocode_status)
    else:
        raise ValueError("--geocode-status 또는 --regeocode-work-location-ids 중 하나는 필수입니다.")
    query = query.order("id", desc=False)
    if limit:
        query = query.limit(limit)
    resp = query.execute()
    return resp.data or []


def _group_key(row: dict) -> str:
    """중복 판정 기준 — DB에 이미 저장된 normalized_address를 그대로 쓴다
    (job_work_locations의 트리거가 unaccent+lower로 채운 값, 두 번째 사용자
    지시의 '캐시는 normalized_address 기준으로 조회' 원칙과 동일한 키)."""
    return row.get("normalized_address") or (row.get("raw_address") or "").strip().lower()


def group_by_normalized_address(rows: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {}
    for r in rows:
        groups.setdefault(_group_key(r), []).append(r)
    return groups


def build_dry_run_report(rows: list[dict]) -> dict:
    """DB에 쓰지 않고, geocode_cache만 읽어(peek_geocode_cache — API 호출 없음)
    각 대상 행의 예상 처리 결과를 만든다. 사용자 지시 7번: "중복된
    normalized_address를 묶어 실제 고유 API 호출 예정 건수를 계산" —
    행 수(len(rows))와 실제 호출 수를 동일하다고 가정하지 않는다. 두 가지
    이유로 다르다: (1) 같은 정규화 주소를 가진 행이 여러 개면 대표 1건만
    실제로 질의하고 나머지는 그 결과를 그대로 재사용, (2) 대표 1건이라도
    resolve_coordinate_accuracy()의 질의 변형(raw/normalized/structured/
    place_name_only/bbox)마다 캐시가 각각 미스일 수 있어 한 주소가 여러 번
    호출될 수 있다."""
    groups = group_by_normalized_address(rows)
    report_rows: list[dict] = []
    cache_hit_variants = 0
    cache_miss_variants = 0

    for norm_addr, members in groups.items():
        representative = members[0]
        raw_address = representative.get("raw_address") or ""
        if not raw_address.strip():
            for m in members:
                report_rows.append({
                    "id": m["id"], "raw_address": raw_address, "normalized_address": norm_addr,
                    "cache_key": None, "cache_status": "n/a", "will_call_api": False,
                    "api_calls_expected": 0, "skip_reason": "raw_address가 비어 있음 — 처리 제외",
                })
            continue

        province = guess_province_from_text(raw_address)
        variant_peeks = peek_geocode_cache(raw_address, province)
        miss_variants = [v for v in variant_peeks if not v["cache_hit"]]
        hit_variants = [v for v in variant_peeks if v["cache_hit"]]
        cache_hit_variants += len(hit_variants)
        cache_miss_variants += len(miss_variants)
        primary = variant_peeks[0] if variant_peeks else None

        report_rows.append({
            "id": representative["id"],
            "raw_address": raw_address,
            "normalized_address": norm_addr,
            "cache_key": primary["cache_key"] if primary else None,
            "cache_status": "hit" if (primary and primary["cache_hit"]) else "miss",
            "will_call_api": len(miss_variants) > 0,
            "api_calls_expected": len(miss_variants),
            "skip_reason": None,
        })
        for dup in members[1:]:
            report_rows.append({
                "id": dup["id"],
                "raw_address": dup.get("raw_address") or "",
                "normalized_address": norm_addr,
                "cache_key": primary["cache_key"] if primary else None,
                "cache_status": "n/a (dedup)",
                "will_call_api": False,
                "api_calls_expected": 0,
                "skip_reason": f"중복 normalized_address — 대표 행 id={representative['id']}와 동일해 별도 API 호출 불필요",
            })

    return {
        "rows": report_rows,
        "total_rows": len(rows),
        "unique_normalized_addresses": len(groups),
        "cache_hit_variant_count": cache_hit_variants,
        "cache_miss_variant_count": cache_miss_variants,
        "unique_api_calls_expected": cache_miss_variants,
    }


def _build_update_payload(coord: dict, raw_address: str) -> dict:
    """사용자 지시 8/9번: 좌표를 찾았을 때만 lat/lng/coordinate_accuracy/
    address_accuracy/province/district/geocode_status/geocode_source를
    갱신한다. 실패 시에는 그 필드들을 절대 건드리지 않고(기존 값 보존 —
    'pending'이던 값이 이유 없이 다른 값으로 덮이지 않음), geocode_status만
    'failed'로, 실패 원인은 address_evidence(기존에 이미 있는 감사용 컬럼,
    migration 0015)에 기록한다."""
    lat, lng = coord.get("lat"), coord.get("lng")
    if lat is None or lng is None:
        return {
            "geocode_status": "failed",
            "address_evidence": coord.get("evidence") or "좌표를 찾지 못함",
        }
    top = coord.get("top") or {}
    class_result = classify_work_location_candidate(raw_address)
    address_accuracy = "exact_text" if class_result == "exact" else "region_only"
    return {
        "lat": lat,
        "lng": lng,
        "coordinate_accuracy": coord.get("coordinate_accuracy"),
        "address_accuracy": address_accuracy,
        "province": top.get("state") or guess_province_from_text(raw_address),
        "district": top.get("county") or top.get("city"),
        "geocode_status": "success",
        "geocode_source": coord.get("geocode_source"),
    }


def process_apply(rows: list[dict]) -> list[dict]:
    """--apply일 때만 호출됨 — 실제로 Geoapify를 부르고(캐시 미스분만)
    job_work_locations를 UPDATE한다. 같은 normalized_address 그룹은 대표
    1건만 실제로 지오코딩하고, 그 결과를 그룹 전체 행에 동일하게 적용한다."""
    groups = group_by_normalized_address(rows)
    results: list[dict] = []
    for members in groups.values():
        representative = members[0]
        raw_address = representative.get("raw_address") or ""
        if not raw_address.strip():
            for m in members:
                results.append({"id": m["id"], "found": False, "update": None, "skipped": "빈 raw_address"})
            continue
        province = guess_province_from_text(raw_address)
        coord = resolve_coordinate_accuracy(raw_address, province)
        update = _build_update_payload(coord, raw_address)
        found = update.get("lat") is not None
        for m in members:
            if supabase:
                supabase.table("job_work_locations").update(update).eq("id", m["id"]).execute()
            results.append({"id": m["id"], "found": found, "update": update, "skipped": None})
    return results


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="job_work_locations 좌표 재지오코딩 CLI — 기본은 항상 dry-run.")
    p.add_argument("--geocode-status", choices=["pending", "success", "failed", "manual"], default=None,
                    help="이 geocode_status인 행을 대상으로 함")
    p.add_argument("--regeocode-work-location-ids", default=None,
                    help="쉼표로 구분된 job_work_locations.id 목록 (예: 101,102,103)")
    p.add_argument("--apply", action="store_true", help="실제로 Geoapify를 호출하고 DB를 갱신함(기본은 dry-run)")
    p.add_argument("--limit", type=int, default=None, help="처리할 최대 행 수")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    ids: list[int] | None = None
    if args.regeocode_work_location_ids:
        ids = [int(x) for x in args.regeocode_work_location_ids.split(",") if x.strip()]
    if not ids and not args.geocode_status:
        print("❌ --geocode-status 또는 --regeocode-work-location-ids 중 하나는 필수입니다.")
        return 1

    rows = fetch_target_rows(args.geocode_status, ids, args.limit)
    print(f"대상 행: {len(rows)}건")

    if not args.apply:
        report = build_dry_run_report(rows)
        print(f"고유 normalized_address: {report['unique_normalized_addresses']}건")
        print(f"캐시 변형 hit/miss: {report['cache_hit_variant_count']}/{report['cache_miss_variant_count']}")
        print(f"신규 API 호출 예정(고유 변형 기준): {report['unique_api_calls_expected']}건")
        print()
        for r in report["rows"]:
            print(f"id={r['id']} raw={r['raw_address']!r} normalized={r['normalized_address']!r} "
                  f"cache_key={r['cache_key']!r} status={r['cache_status']} "
                  f"will_call_api={r['will_call_api']} calls={r['api_calls_expected']} "
                  f"skip_reason={r['skip_reason']!r}")
        return 0

    results = process_apply(rows)
    success = sum(1 for r in results if r["found"])
    print(f"처리 완료: {len(results)}건 (성공 {success}건 / 실패 {len(results) - success}건)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

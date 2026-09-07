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

from geocode import _region_text_matches, peek_geocode_cache, resolve_coordinate_accuracy
from job_quality import classify_work_location_candidate, guess_province_from_text

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

SELECT_COLUMNS = (
    "id,job_id,raw_address,normalized_address,geocode_status,geocode_source,"
    "coordinate_accuracy,address_accuracy,province,district,lat,lng,matched_recruitment_regions"
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

        province = _resolve_province_hint(representative)
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


def _resolve_province_hint(row: dict) -> str | None:
    """이 행의 '원문 행정구역' 기준을 정한다 — matched_recruitment_regions
    (크롤러가 원문 "Tỉnh/Thành:" 접두사에서 직접 읽어 이미 DB에 저장해 둔,
    가장 신뢰할 수 있는 지역 라벨)를 최우선으로 쓴다.

    2026-09-08 사용자 지시로 신설 — 실측 버그(job_id=4459/4565/4390 등 다수):
    기존에는 이 값 대신 guess_province_from_text(raw_address)로 주소 '텍스트'
    자체에서 지역명을 재추측했는데, "Lạng Sơn"/"Thanh Trì"(하노이 구)/"Quận 10"
    (호치민 구)처럼 텍스트에 성 전체 이름이 없거나 job_quality의 인식 목록에
    없는 지역명은 추측에 실패해 None이 됐다. resolve_coordinate_accuracy()는
    province가 None이면 _region_text_matches()가 무조건 True를 반환해 지역
    검증이 완전히 무력화되고, 그 결과 Geoapify가 반환한 지리적으로 무관한
    동명 지점이 confidence와 무관하게 'ward'/'exact_candidate' 등급으로
    승격됐다(실측: "Lạng Sơn"이 Đắk Lắk의 동명 마을로, confidence=1.0으로
    잘못 매칭됨). matched_recruitment_regions가 없을 때만 기존처럼 텍스트
    추측으로 보조한다(둘 다 없으면 호출부가 None으로 처리)."""
    regions = row.get("matched_recruitment_regions") or []
    if regions:
        return regions[0]
    return guess_province_from_text(row.get("raw_address") or "")


def _region_matches_strictly(top: dict | None, expected_region_text: str | None) -> bool:
    """success 저장 최종 관문 전용 — geocode._region_text_matches()보다
    엄격하다. 그 함수는 state/county/city/formatted/address_line2 등 여러
    필드 아무 곳에서나 일치하면 True를 반환하는데(OSM 데이터의 필드 불일치를
    감안한 의도적 관대함 — resolve_coordinate_accuracy()의 등급 산정 자체는
    그대로 유지, 여기서 건드리지 않음), 이 관대함이 실측 회귀(2026-09-08,
    job_id=4459)에서 오탐을 냈다: "Lạng Sơn"이 Đắk Lắk 성 안의 동명 마을로
    잘못 매칭됐는데, state="Đắk Lắk Province"는 명백히 다름에도 city 필드가
    우연히 "Lạng Sơn"이라 전체 검사가 통과해버렸다.

    이 함수는 가장 권위 있는 필드인 state가 있으면 그것만으로 판정한다 —
    state가 다르면 다른 필드가 우연히 일치해도 불일치로 확정한다. state
    자체가 없는 드문 경우(sparse-metadata 응답)에만 기존 관대한 검사로
    보조한다."""
    if not expected_region_text:
        return True
    state = (top or {}).get("state")
    if state:
        return _region_text_matches({"state": state}, expected_region_text)
    return _region_text_matches(top, expected_region_text)


def _build_update_payload(coord: dict, raw_address: str, province: str | None) -> dict:
    """사용자 지시 8/9번: 좌표를 찾았을 때만 lat/lng/coordinate_accuracy/
    address_accuracy/province/district/geocode_status/geocode_source를
    갱신한다. 실패 시에는 그 필드들을 절대 건드리지 않고(기존 값 보존 —
    'pending'이던 값이 이유 없이 다른 값으로 덮이지 않음), geocode_status만
    'failed'로, 실패 원인은 address_evidence(기존에 이미 있는 감사용 컬럼,
    migration 0015)에 기록한다.

    2026-09-07 사용자 지시로 수정 — 'exact_candidate'(2개 이상 변형이 좌표에
    자기수렴했지만 독립 검증은 없음, canary 실측: id=281 'Aeon Mall Hà Đông'가
    2개 변형 모두 동일 좌표로 수렴)를 'failed'로 버리면 실제로 찾아낸 후보가
    있었다는 사실 자체가 사라져 재조사할 단서가 없어진다. job_work_locations.
    geocode_status는 애초에 migration 0010부터 'manual'을 허용해 왔고(스키마
    변경 불필요), address_evidence는 자유 텍스트라 후보 좌표를 사람이 읽을 수
    있는 형태로 그대로 적어둘 수 있다 — 두 필드 모두 기존 스키마 그대로 재사용.
    확정하지 못한 후보값은 오직 address_evidence 텍스트로만 남긴다.

    2026-09-08 사용자 지시로 수정(실측 버그: id=622 "462/11 Nguyen Tri
    Phuong..." — success였다가 이번 지역 재검증으로 manual로 낮아졌는데도
    이전 success 시절의 잘못된 lat/lng이 DB에 그대로 남아있었음) — manual/
    failed로 낮추는 모든 경로가 이제 lat/lng/coordinate_accuracy/
    geocode_source를 payload에 명시적으로 None으로 넣는다. 이 CLI는
    'pending'(애초에 좌표가 null)뿐 아니라 이미 'success'였던 행을 재검증해
    낮추는 경우에도 호출되므로, 예전처럼 "그 키를 아예 안 넣으면 기존 값이
    보존된다"는 가정(Supabase update는 부분 업데이트라 payload에 없는
    컬럼은 그대로 남음)이 더 이상 안전하지 않다 — 신뢰할 수 없는 좌표는
    반드시 명시적으로 지워야 지도/거리검색에 잘못 노출되지 않는다."""
    lat, lng = coord.get("lat"), coord.get("lng")
    tier = coord.get("coordinate_accuracy")

    # crawl_topcv.py의 _coordinate_accuracy_for_db()와 동일한 정책(2026-09-04
    # 사용자 지시): job_work_locations.coordinate_accuracy CHECK 제약
    # (migration 0015)은 ('exact','ward','region','unresolved')만 허용하고
    # 'exact_candidate'는 없다 — resolve_coordinate_accuracy()가 내부적으로만
    # 쓰는 어휘라 coordinate_accuracy 컬럼에 그대로 쓰면 제약 위반이다(실측:
    # 이 CLI의 첫 실제 --apply 실행에서 바로 이 위반으로 크래시함). "exact_
    # candidate를 DB의 exact로 단순 매핑하지 않음 — 독립 검증 성공 시에만
    # exact" 원칙도 동일 — 이 CLI는 크롤링 당시의 vieclam24h 원문 좌표 같은
    # 독립 검증 신호(source_verified)를 애초에 가질 수 없으므로(그 신호는
    # 크롤링 시점에만 존재), exact_candidate는 여기서 절대 'exact'/'success'로
    # 확정하지 않고 'manual'(수동 확인 대상)로 분리해 후보 좌표만 감사 기록으로
    # 남긴다.
    if tier == "exact_candidate":
        return {
            "lat": None, "lng": None, "coordinate_accuracy": "unresolved", "geocode_source": None,
            "geocode_status": "manual",
            "address_evidence": (
                f"exact_candidate(2개 이상 변형 자기수렴, 독립 검증 없음 — 수동 확인 필요) "
                f"후보 좌표: lat={lat}, lng={lng}. {coord.get('evidence') or ''}"
            ).strip(),
        }

    if lat is None or lng is None:
        return {
            "lat": None, "lng": None, "coordinate_accuracy": "unresolved", "geocode_source": None,
            "geocode_status": "failed",
            "address_evidence": coord.get("evidence") or "좌표를 찾지 못함",
        }
    top = coord.get("top") or {}

    # 2026-09-08 사용자 지시 2번 — 원문 행정구역 기준(province) 자체를 못
    # 구했으면(matched_recruitment_regions도 없고 주소 텍스트에서도 추측
    # 실패) 지역 검증을 자동 통과시키지 않는다 — 좌표는 있지만 어느 지역이
    # 맞는지 확인할 근거가 없으므로 무조건 manual(수동 확인)로 낮춘다.
    if province is None:
        return {
            "lat": None, "lng": None, "coordinate_accuracy": "unresolved", "geocode_source": None,
            "geocode_status": "manual",
            "address_evidence": (
                f"원문 행정구역 기준을 확인할 수 없어 좌표를 그대로 신뢰할 수 없음(수동 확인 필요) "
                f"— 후보 좌표: lat={lat}, lng={lng}. {coord.get('evidence') or ''}"
            ).strip(),
        }

    # 2026-09-08 사용자 지시 3번 — 원문 행정구역과 실제 채택된 Geoapify 결과의
    # 행정구역이 다르면 success로 저장하지 않는다. resolve_coordinate_accuracy()
    # 내부에서도 province가 주어지면 이미 _region_text_matches()로 후보를
    # 거르지만, 저장 직전 이 함수 하나에서 다시 한번 독립적으로 확인해 —
    # "success로 저장되는 모든 행은 반드시 이 검사를 통과했다"를 이 함수
    # 하나만 보고도 보장한다(내부 로직이 나중에 바뀌어도 이 최종 관문은
    # 항상 동작).
    if not _region_matches_strictly(top, province):
        return {
            "lat": None, "lng": None, "coordinate_accuracy": "unresolved", "geocode_source": None,
            "geocode_status": "manual",
            "address_evidence": (
                f"원문 행정구역({province})과 반환된 좌표의 행정구역이 일치하지 않아 저장 보류(수동 확인 필요) "
                f"— 후보 좌표: lat={lat}, lng={lng}. {coord.get('evidence') or ''}"
            ).strip(),
        }

    class_result = classify_work_location_candidate(raw_address)
    address_accuracy = "exact_text" if class_result == "exact" else "region_only"
    return {
        "lat": lat,
        "lng": lng,
        "coordinate_accuracy": tier,
        "address_accuracy": address_accuracy,
        "province": top.get("state") or province,
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
        province = _resolve_province_hint(representative)
        coord = resolve_coordinate_accuracy(raw_address, province)
        update = _build_update_payload(coord, raw_address, province)
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

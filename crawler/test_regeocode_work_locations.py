"""2026-09-07 사용자 지시로 신설 — regeocode_work_locations.py의 순수 로직
(중복 정규화 주소 묶기, dry-run 집계, 성공/실패 시 UPDATE payload 구성)을
네트워크 없이 검증한다. fetch_target_rows()/process_apply()의 실제 Supabase
호출부는 여기서 테스트하지 않는다(테스트 환경에서 실제 DB에 쓰면 안 되므로) —
대신 이 파일이 직접 조립하는 payload/집계 로직만 monkeypatch로 격리해 확인한다."""

from __future__ import annotations

import regeocode_work_locations as rwl


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def test_group_by_normalized_address_dedupes_rows() -> None:
    rows = [
        {"id": 1, "raw_address": "Toàn khu vực, Vũng Tàu", "normalized_address": "toan khu vuc, vung tau"},
        {"id": 2, "raw_address": "toàn khu vực, vũng tàu", "normalized_address": "toan khu vuc, vung tau"},
        {"id": 3, "raw_address": "Toàn khu vực, Hà Nội", "normalized_address": "toan khu vuc, ha noi"},
    ]
    groups = rwl.group_by_normalized_address(rows)
    assert_equal(len(groups), 2, "서로 다른 normalized_address 2개만 그룹으로 남아야 함")
    assert_equal(len(groups["toan khu vuc, vung tau"]), 2, "같은 normalized_address를 가진 두 행이 한 그룹으로 묶여야 함")


def test_build_dry_run_report_counts_unique_api_calls_not_row_count() -> None:
    """사용자 지시 7번 회귀 테스트 — 행 수(3)와 실제 호출 예정 수를 동일하다고
    가정하지 않는다: 2개 행이 같은 정규화 주소를 공유하면 대표 1건만 캐시를
    조회하고, 나머지는 별도 API 호출 없이 dedup 처리돼야 한다."""
    rows = [
        {"id": 1, "raw_address": "Toàn khu vực, Vũng Tàu", "normalized_address": "dup-addr"},
        {"id": 2, "raw_address": "Toàn khu vực, Vũng Tàu", "normalized_address": "dup-addr"},
        {"id": 3, "raw_address": "Toàn khu vực, Hà Nội", "normalized_address": "unique-addr"},
    ]

    def fake_peek(raw_address: str, province: str | None):
        if raw_address == "Toàn khu vực, Vũng Tàu":
            return [
                {"variant": "raw", "query": "q1", "cache_key": "k1", "cache_hit": False, "cached_status": None},
                {"variant": "bbox", "query": "q2", "cache_key": "k2", "cache_hit": False, "cached_status": None},
            ]
        return [
            {"variant": "raw", "query": "q3", "cache_key": "k3", "cache_hit": True, "cached_status": "no_results"},
        ]

    original = rwl.peek_geocode_cache
    try:
        rwl.peek_geocode_cache = fake_peek
        report = rwl.build_dry_run_report(rows)
    finally:
        rwl.peek_geocode_cache = original

    assert_equal(report["total_rows"], 3, "입력 행 수는 그대로 3건")
    assert_equal(report["unique_normalized_addresses"], 2, "고유 normalized_address는 2개(dup-addr, unique-addr)")
    # dup-addr 대표 1건만 2개 변형을 조회(둘 다 miss) + unique-addr 1건이 1개 변형 조회(hit)
    assert_equal(report["cache_miss_variant_count"], 2, "실제로 API를 불러야 할 변형은 2개뿐(대표 행 기준) — 중복 행(id=2)은 다시 세지 않음")
    assert_equal(report["cache_hit_variant_count"], 1, "unique-addr 쪽 1개 변형은 캐시 hit")
    assert_equal(report["unique_api_calls_expected"], 2, "행 수(3)가 아니라 고유 변형 미스 수(2)를 호출 예정 건수로 보고해야 함")

    dup_row = next(r for r in report["rows"] if r["id"] == 2)
    assert_equal(dup_row["will_call_api"], False, "중복 행은 API를 부르지 않음")
    assert_equal(dup_row["skip_reason"] is not None and "id=1" in dup_row["skip_reason"], True, "중복 행의 제외 사유에 대표 행 id가 남아야 함")

    rep_row = next(r for r in report["rows"] if r["id"] == 1)
    assert_equal(rep_row["will_call_api"], True, "대표 행은 캐시 미스가 있으므로 API 호출 예정이어야 함")
    assert_equal(rep_row["api_calls_expected"], 2, "대표 행의 호출 예정 수는 미스난 변형 수(2)와 같아야 함")


def test_build_dry_run_report_excludes_empty_raw_address() -> None:
    rows = [{"id": 9, "raw_address": "  ", "normalized_address": "empty"}]
    report = rwl.build_dry_run_report(rows)
    assert_equal(report["rows"][0]["skip_reason"], "raw_address가 비어 있음 — 처리 제외", "빈 주소는 제외 사유가 남아야 함")
    assert_equal(report["rows"][0]["will_call_api"], False, "빈 주소는 API를 부르지 않음")


def test_update_payload_only_fills_fields_on_success() -> None:
    coord = {
        "lat": 10.1, "lng": 106.1, "coordinate_accuracy": "region",
        "geocode_source": "geoapify", "evidence": "ok",
        "top": {"state": "Bà Rịa - Vũng Tàu", "county": "Vũng Tàu", "city": None},
    }
    update = rwl._build_update_payload(coord, "Toàn khu vực, Vũng Tàu")
    assert_equal(update["lat"], 10.1, "성공 시 lat 갱신")
    assert_equal(update["lng"], 106.1, "성공 시 lng 갱신")
    assert_equal(update["coordinate_accuracy"], "region", "성공 시 coordinate_accuracy 갱신")
    assert_equal(update["province"], "Bà Rịa - Vũng Tàu", "성공 시 Geoapify top의 state를 province로 사용")
    assert_equal(update["district"], "Vũng Tàu", "성공 시 Geoapify top의 county를 district로 사용")
    assert_equal(update["geocode_status"], "success", "성공 시 geocode_status='success'")
    assert_equal(update["geocode_source"], "geoapify", "성공 시 geocode_source 갱신")


def test_update_payload_on_failure_never_touches_address_fields() -> None:
    """사용자 지시 9번 회귀 테스트 — 실패 시 기존 주소/좌표 관련 필드를
    훼손하지 않고 geocode_status와 실패 원인(address_evidence)만 기록해야
    한다. lat/lng/coordinate_accuracy/address_accuracy/province/district
    키가 payload 자체에 아예 없어야 UPDATE가 그 컬럼들을 건드리지 않는다."""
    coord = {"lat": None, "lng": None, "coordinate_accuracy": "unresolved", "evidence": "no result confirmed the expected province", "top": None}
    update = rwl._build_update_payload(coord, "Toàn khu vực, Vũng Tàu")
    assert_equal(update, {"geocode_status": "failed", "address_evidence": "no result confirmed the expected province"},
                 "실패 시 payload에는 geocode_status/address_evidence 외 다른 키가 있으면 안 됨")


def main() -> int:
    tests = [
        test_group_by_normalized_address_dedupes_rows,
        test_build_dry_run_report_counts_unique_api_calls_not_row_count,
        test_build_dry_run_report_excludes_empty_raw_address,
        test_update_payload_only_fills_fields_on_success,
        test_update_payload_on_failure_never_touches_address_fields,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} regeocode_work_locations tests passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"❌ {exc}")
        raise SystemExit(1)
    except Exception as exc:
        print(f"❌ unexpected error: {exc}")
        raise SystemExit(1)

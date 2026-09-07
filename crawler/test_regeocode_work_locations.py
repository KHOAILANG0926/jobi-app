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
    update = rwl._build_update_payload(coord, "Toàn khu vực, Vũng Tàu", "Bà Rịa - Vũng Tàu")
    assert_equal(update["lat"], 10.1, "성공 시 lat 갱신")
    assert_equal(update["lng"], 106.1, "성공 시 lng 갱신")
    assert_equal(update["coordinate_accuracy"], "region", "성공 시 coordinate_accuracy 갱신")
    assert_equal(update["province"], "Bà Rịa - Vũng Tàu", "성공 시 Geoapify top의 state를 province로 사용")
    assert_equal(update["district"], "Vũng Tàu", "성공 시 Geoapify top의 county를 district로 사용")
    assert_equal(update["geocode_status"], "success", "성공 시 geocode_status='success'")
    assert_equal(update["geocode_source"], "geoapify", "성공 시 geocode_source 갱신")


def test_update_payload_on_failure_never_touches_address_fields() -> None:
    """사용자 지시 9번 회귀 테스트 — 실패 시 geocode_status와 실패 원인
    (address_evidence)을 기록하고, 좌표 관련 필드(lat/lng/coordinate_accuracy/
    geocode_source)는 명시적으로 비워야 한다(2026-09-08 수정 — 이전에는 이
    키들을 payload에서 아예 빼서 "안 건드림"을 노렸는데, 이 함수가 이미
    'success'였던 행을 낮추는 경우에도 호출되면서 예전 좌표가 그대로 남는
    실측 버그(id=622)가 났다 — 이제 명시적으로 None을 써서 확실히 지운다).
    address_accuracy/province/district는 여전히 건드리지 않는다(이 필드들은
    실패와 무관하게 원문 텍스트 자체의 성질이므로 보존)."""
    coord = {"lat": None, "lng": None, "coordinate_accuracy": "unresolved", "evidence": "no result confirmed the expected province", "top": None}
    update = rwl._build_update_payload(coord, "Toàn khu vực, Vũng Tàu", "Bà Rịa - Vũng Tàu")
    assert_equal(
        update,
        {
            "lat": None, "lng": None, "coordinate_accuracy": "unresolved", "geocode_source": None,
            "geocode_status": "failed", "address_evidence": "no result confirmed the expected province",
        },
        "실패 시 payload는 좌표 필드를 명시적으로 None으로 지우고, address_accuracy/province/district는 건드리면 안 됨",
    )


def test_update_payload_routes_unverified_exact_candidate_to_manual_not_failed() -> None:
    """실측 회귀 테스트(2026-09-07) — id=281 'Aeon Mall Hà Đông, Hà Đông'는
    2개 변형이 동일 좌표로 자기수렴한 'exact_candidate'였다. 이 CLI는
    crawl_topcv.py의 source_verified(크롤링 당시 원문 좌표 검증) 신호를
    가질 수 없으므로 'exact'/'success'로 확정할 수는 없지만, 후보를 통째로
    'failed'로 버리면 "실제로 찾아낸 좌표가 있었다"는 사실 자체가 사라져
    사람이 재검토할 단서가 없어진다 — 대신 geocode_status='manual'로 분리하고
    (스키마 변경 없이 이미 migration 0010부터 허용된 값), 후보 좌표는
    address_evidence(기존 감사용 텍스트 컬럼, 스키마 변경 없음)에 사람이
    읽을 수 있게 남긴다. lat/lng/coordinate_accuracy 컬럼은 명시적으로
    None으로 지운다(2026-09-08 수정 — 이 행이 이전에 'success'였을 수 있어
    "안 건드림"만으로는 옛 좌표가 남을 수 있음, 실측 id=622 참고)."""
    coord = {
        "lat": 20.9894507, "lng": 105.7506251, "coordinate_accuracy": "exact_candidate",
        "geocode_source": "geoapify", "evidence": "2 variants converged",
        "top": {"state": "Hà Nội", "county": None, "city": None},
    }
    update = rwl._build_update_payload(coord, "Aeon Mall Hà Đông, Hà Đông", "Hà Nội")
    assert_equal(update["geocode_status"], "manual", "exact_candidate(미검증)는 'failed'가 아니라 'manual'로 분리해야 함")
    assert_equal(set(update.keys()), {"geocode_status", "address_evidence", "lat", "lng", "coordinate_accuracy", "geocode_source"}, "manual payload는 좌표 필드를 포함하되 전부 None으로 지워야 함")
    assert_equal(update["lat"] is None and update["lng"] is None and update["coordinate_accuracy"] == "unresolved" and update["geocode_source"] is None, True,
                 "manual로 낮출 때 후보 좌표 자체는 DB 컬럼에서 반드시 제거돼야 함(옛 success 좌표가 남으면 안 됨)")
    assert_equal("20.9894507" in update["address_evidence"] and "105.7506251" in update["address_evidence"], True,
                 "후보 좌표(lat/lng)가 사람이 읽을 수 있는 형태로 address_evidence에 보존돼야 함")


def test_failed_and_manual_are_distinguishable_outcomes() -> None:
    """사용자 지시 3번 — failed(후보 자체가 없음)와 manual(후보는 있으나
    미검증)이 geocode_status 값으로 명확히 구분되는지 직접 확인한다. 같은
    함수(_build_update_payload)에 서로 다른 coord 입력을 넣어, 하나는
    'failed'로 다른 하나는 'manual'로 갈라져야 하고 서로 절대 섞이면 안 된다."""
    no_candidate = rwl._build_update_payload(
        {"lat": None, "lng": None, "coordinate_accuracy": "region", "evidence": "province confirmed only", "top": None},
        "Khu vực, Bến Tre", "Bến Tre",
    )
    unverified_candidate = rwl._build_update_payload(
        {"lat": 21.0, "lng": 105.8, "coordinate_accuracy": "exact_candidate", "evidence": "converged", "top": {}},
        "KCN Nào Đó, Hà Nội", "Hà Nội",
    )
    assert_equal(no_candidate["geocode_status"], "failed", "후보 좌표가 아예 없는 경우는 failed여야 함")
    assert_equal(unverified_candidate["geocode_status"], "manual", "후보 좌표가 있지만 미검증인 경우는 manual이어야 함")
    assert_equal(no_candidate["geocode_status"] != unverified_candidate["geocode_status"], True,
                 "failed와 manual은 서로 다른 값이어야 하며 섞여서는 안 됨")


def test_resolve_province_hint_prefers_matched_recruitment_regions() -> None:
    """2026-09-08 사용자 지시 1번 — matched_recruitment_regions(원문 "Tỉnh/
    Thành:" 접두사에서 이미 확인돼 DB에 저장된 지역 라벨)를 텍스트 재추측
    (guess_province_from_text)보다 항상 우선해야 한다. 실측 회귀: "Lạng sơn,
    Lạng Sơn"은 guess_province_from_text가 인식 못해 None을 반환하지만,
    matched_recruitment_regions=['Lạng Sơn']이 있으면 그걸 그대로 써야 한다."""
    row_with_region = {"raw_address": "Lạng sơn, Lạng Sơn", "matched_recruitment_regions": ["Lạng Sơn"]}
    assert_equal(rwl._resolve_province_hint(row_with_region), "Lạng Sơn", "matched_recruitment_regions이 있으면 그 첫 값을 그대로 써야 함")

    row_without_region = {"raw_address": "Lạng sơn, Lạng Sơn", "matched_recruitment_regions": []}
    assert_equal(rwl._resolve_province_hint(row_without_region), None,
                 "matched_recruitment_regions이 없고 텍스트 추측도 실패하면(실측: 'Lạng Sơn'은 인식 목록에 없음) None이어야 함")

    row_recognizable_text = {"raw_address": "212 Hoàng Hoa Thám, Hà Nội", "matched_recruitment_regions": []}
    assert_equal(rwl._resolve_province_hint(row_recognizable_text), "Hà Nội",
                 "matched_recruitment_regions이 없을 때만 기존처럼 텍스트 추측으로 보조해야 함")


def test_update_payload_forces_manual_when_province_unknown_even_with_real_coordinates() -> None:
    """2026-09-08 사용자 지시 2번 회귀 테스트 — province를 구하지 못했으면
    (None) resolve_coordinate_accuracy()가 'ward'/'exact_candidate' 등급의
    실제 좌표를 반환했더라도 지역 검증을 자동 통과시키지 않고 무조건
    manual로 낮춰야 한다. 좌표 자체(lat/lng)는 DB 컬럼에 쓰지 않는다."""
    coord = {
        "lat": 12.7513492, "lng": 108.2729969, "coordinate_accuracy": "ward",
        "geocode_source": "geoapify", "evidence": "2 variants converged <=300m",
        "top": {"state": "Đắk Lắk Province", "county": "Xã Krông Pắc", "city": "Lạng Sơn"},
    }
    update = rwl._build_update_payload(coord, "Lạng sơn, Lạng Sơn", None)
    assert_equal(update["geocode_status"], "manual", "province=None이면 ward 등급이어도 success가 아니라 manual이어야 함")
    assert_equal(update["lat"], None, "province=None으로 manual 처리 시 후보 좌표를 DB lat 컬럼에 남기면 안 됨")
    assert_equal(update["lng"], None, "province=None으로 manual 처리 시 후보 좌표를 DB lng 컬럼에 남기면 안 됨")
    assert_equal("12.7513492" in update["address_evidence"], True, "후보 좌표가 address_evidence에 감사 기록으로 남아야 함")


def test_update_payload_forces_manual_when_region_mismatch() -> None:
    """2026-09-08 사용자 지시 3번 회귀 테스트(실측 job_id=4459 재현) — 원문
    행정구역("Lạng Sơn")과 Geoapify가 실제로 반환한 좌표의 행정구역
    ("Đắk Lắk Province")이 다르면, ward 등급으로 수렴했더라도 절대 success로
    저장하면 안 된다."""
    coord = {
        "lat": 12.7513492, "lng": 108.2729969, "coordinate_accuracy": "ward",
        "geocode_source": "geoapify", "evidence": "2 variants converged <=300m",
        "top": {"state": "Đắk Lắk Province", "county": "Xã Krông Pắc", "city": "Lạng Sơn"},
    }
    update = rwl._build_update_payload(coord, "Lạng sơn, Lạng Sơn", "Lạng Sơn")
    assert_equal(update["geocode_status"], "manual", "원문 지역과 반환된 좌표의 지역이 다르면 success가 아니라 manual이어야 함")
    assert_equal(update["lat"], None, "지역 불일치로 manual 처리 시 잘못된 후보 좌표를 DB lat 컬럼에 남기면 안 됨(실측 id=622 회귀 방지)")
    assert_equal(update["lng"], None, "지역 불일치로 manual 처리 시 잘못된 후보 좌표를 DB lng 컬럼에 남기면 안 됨(실측 id=622 회귀 방지)")
    assert_equal("Lạng Sơn" in update["address_evidence"], True, "원문 행정구역 이름이 사유에 남아야 함")


def test_update_payload_still_succeeds_when_region_genuinely_matches() -> None:
    """대조군 — province가 있고 반환된 좌표의 지역이 실제로 일치하면 여전히
    success로 정상 저장돼야 한다(이번 수정이 정상 케이스까지 막아버리는
    회귀가 아님을 확인)."""
    coord = {
        "lat": 21.0149457, "lng": 105.8520631, "coordinate_accuracy": "ward",
        "geocode_source": "geoapify", "evidence": "2 variants converged <=300m",
        "top": {"state": "Ha Noi", "county": "Hai Ba Trung", "city": None},
    }
    update = rwl._build_update_payload(coord, "Số 24 Dương Văn Bé, Hai Bà Trưng", "Hà Nội")
    assert_equal(update["geocode_status"], "success", "지역이 실제로 일치하면 여전히 success여야 함")
    assert_equal(update["lat"], 21.0149457, "좌표가 정상적으로 저장돼야 함")


def main() -> int:
    tests = [
        test_group_by_normalized_address_dedupes_rows,
        test_build_dry_run_report_counts_unique_api_calls_not_row_count,
        test_build_dry_run_report_excludes_empty_raw_address,
        test_update_payload_only_fills_fields_on_success,
        test_update_payload_on_failure_never_touches_address_fields,
        test_update_payload_routes_unverified_exact_candidate_to_manual_not_failed,
        test_failed_and_manual_are_distinguishable_outcomes,
        test_resolve_province_hint_prefers_matched_recruitment_regions,
        test_update_payload_forces_manual_when_province_unknown_even_with_real_coordinates,
        test_update_payload_forces_manual_when_region_mismatch,
        test_update_payload_still_succeeds_when_region_genuinely_matches,
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

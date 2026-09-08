"""2026-09-08 사용자 지시로 신설 — VietnamWorks 크롤러(crawl_topcv.py의
build_vietnamworks_job_record()/관련 헬퍼)의 순수 로직만 오프라인으로
검증한다. 실제 브라우저/네트워크(crawl_vietnamworks_category/
fetch_vietnamworks_job_detail)는 여기서 실행하지 않는다 — 이 파일은
사전 조사(2026-09-08)로 실측 확인한 VietnamWorks 실제 공고 3건(단일
주소/다중 근무지/제목-필드 불일치)의 추출 결과만 대조한다."""

from __future__ import annotations

from crawl_topcv import (
    _enforce_region_confirmed_before_success,
    _vietnamworks_location_candidates,
    _vietnamworks_title_extra_regions,
)
from job_quality import classify_work_location_candidate


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def assert_true(value, label: str) -> None:
    if not value:
        raise AssertionError(label)


# ─── 사례 1: 단일 주소(2026-09-08 사전 조사, Senior CAD Engineer @ Qorvo) ──
# https://www.vietnamworks.com/senior-cad-engineer--2099856-jv
# 원문 "Địa điểm làm việc" 섹션(영어 표기, 베트남어 지명 없음).
def test_single_address_case_qorvo_senior_cad_engineer() -> None:
    location_lines = ["5th Floor, CIC Tower building, No. 2 Nguyen Thi Due Street, Yen Hoa Ward, Hanoi"]

    candidates = _vietnamworks_location_candidates(location_lines)

    assert_equal(len(candidates), 1, "단일 근무지는 후보 1개로 보존돼야 함")
    assert_equal(candidates[0]["text"], location_lines[0], "원문 주소는 그대로 보존(가공/축약 없음)")
    assert_equal(candidates[0]["region_prefix"], "Hà Nội", "영어 표기 'Hanoi'도 지역명으로 인식돼야 함(_PROVINCE_ALIASES)")
    assert_equal(
        classify_work_location_candidate(candidates[0]["text"]), "exact",
        "번지수(No. 2)가 있는 구체 주소는 'exact'로 분류돼야 함",
    )


# ─── 사례 2: 다중 근무지, 제목과 구조 필드 완전 일치 ───────────────────────
# https://www.vietnamworks.com/giam-sat-tram-giao-nhan-tuyen-toan-quoc-2102329-jv
# 원문 "Địa điểm làm việc" 섹션 = 3개 지역, 제목도 3개 지역만 언급(불일치 없음).
def test_multi_location_case_spx_giam_sat_matches_title() -> None:
    location_lines = ["Đồng Nai, Việt Nam", "Hải Phòng, Việt Nam", "Hà Tĩnh, Việt Nam"]
    title = "Giám Sát Trạm Giao Nhận (Tuyển Toàn Quốc)"

    candidates = _vietnamworks_location_candidates(location_lines)

    assert_equal(len(candidates), 3, "구조화된 근무지 3곳 전부 보존돼야 함(하나로 합치거나 누락하면 안 됨)")
    assert_equal(
        [c["text"] for c in candidates], location_lines,
        "원문 순서·문구 그대로 보존",
    )
    assert_equal(
        [c["region_prefix"] for c in candidates], ["Đồng Nai", "Hải Phòng", "Hà Tĩnh"],
        "각 근무지의 지역명이 정확히 인식돼야 함",
    )
    for c in candidates:
        assert_equal(
            classify_work_location_candidate(c["text"]), "region_only",
            f"{c['text']!r}는 번지수/시설명 없는 성·시 단위 언급이라 'region_only'여야 함",
        )

    extra = _vietnamworks_title_extra_regions(title, [c["text"] for c in candidates])
    assert_equal(extra, [], "제목이 구조화 필드와 완전히 일치하면 추가 지역이 없어야 함")


# ─── 사례 3: 다중 근무지, 제목-구조 필드 불일치(실측 발견 — Bạc Liêu 누락) ──
# https://www.vietnamworks.com/quan-ly-van-hanh-khu-vuc-area-operations-manager-bac-ninh-can-tho-ca-mau-bac-lieu-2102332-jv
# 제목: "...- Bắc Ninh, Cần Thơ, Cà Mau, Bạc Liêu"(4개 지역).
# 구조화 "Địa điểm làm việc" 섹션: Bắc Ninh/Cần Thơ/Cà Mau 3개뿐(Bạc Liêu 없음)
# — VietnamWorks 원본 사이트 자체의 불일치이며 크롤러가 만든 오류가 아니다.
def test_title_field_mismatch_case_spx_area_operations_manager() -> None:
    location_lines = ["Bắc Ninh, Việt Nam", "Cần Thơ, Việt Nam", "Cà Mau, Việt Nam"]
    title = "Quản Lý Vận Hành Khu Vực (Area Operations Manager) - Bắc Ninh, Cần Thơ, Cà Mau, Bạc Liêu"

    candidates = _vietnamworks_location_candidates(location_lines)

    # 2026-09-08 사용자 지시 3번 — 충돌·불명확 시 임의로 위치를 추가하지 않는다:
    # 구조화 필드에 없는 "Bạc Liêu"를 제목에서 봤다고 4번째 근무지로 만들어내면 안 됨.
    assert_equal(len(candidates), 3, "구조화 필드에 실제로 있는 3곳만 근무지로 보존해야 함(제목 보고 4곳으로 늘리면 안 됨)")
    assert_equal([c["text"] for c in candidates], location_lines, "구조화 필드 원문 그대로")

    extra = _vietnamworks_title_extra_regions(title, [c["text"] for c in candidates])
    # "Bạc Liêu"는 job_quality.LISTING_CITY_KEYWORDS/_PROVINCE_ALIASES 어디에도
    # 없는 지명이다(2025년 성급 통합으로 다른 성에 흡수됐을 가능성이 있으나
    # 확인되지 않음) — 알려지지 않은 지명을 임의로 추정해 "추가 지역"으로도
    # 확정하지 않는 것이 이 함수의 의도된(올바른) 동작이다.
    assert_equal(extra, [], "인식되지 않는 지명(Bạc Liêu)은 추가 지역으로도 임의 확정하지 않아야 함")


# ─── 추가 검증: "추가 지역 기록" 기능이 인식 가능한 지명에서는 실제로 동작함 ──
def test_title_extra_region_detected_when_province_is_recognized() -> None:
    """위 사례 3은 미인식 지명이라 extra=[]가 나왔을 뿐, 기능 자체가 항상
    빈 값을 반환하는 건 아님을 별도로 확인 — 제목에 있는 지역이 job_quality가
    아는 성·시라면 정확히 그 지역만 "추가 지역"으로 잡아야 한다."""
    title = "Nhân Viên Kinh Doanh - Hà Nội, Đà Nẵng, Cần Thơ"
    structured_texts = ["Hà Nội, Việt Nam", "Đà Nẵng, Việt Nam"]

    extra = _vietnamworks_title_extra_regions(title, structured_texts)

    assert_equal(extra, ["Cần Thơ"], "구조화 필드에 없는, 제목에서만 언급된 인식 가능한 지역만 반환해야 함")


def test_enforce_region_confirmed_downgrades_success_without_matched_regions() -> None:
    """CRAWLER_BASELINE.md 기준 4 — 지역을 하나도 확정 못 한(matched_
    recruitment_regions가 빈) 행이 success로 나왔다면 좌표를 지우고
    실패로 되돌려야 한다."""
    rows = [{
        "raw_address": "Some Building, Some Street", "lat": 10.0, "lng": 106.0,
        "geocode_status": "success", "coordinate_accuracy": "ward",
        "matched_recruitment_regions": [], "source_verified": False,
        "address_evidence": "2 variants converged",
    }]

    result = _enforce_region_confirmed_before_success(rows)

    assert_equal(result[0]["geocode_status"], "failed", "지역 미확정 success는 failed로 강등돼야 함")
    assert_true(result[0]["lat"] is None, "지역 미확정 success의 lat는 반드시 null이어야 함")
    assert_true(result[0]["lng"] is None, "지역 미확정 success의 lng는 반드시 null이어야 함")
    assert_equal(result[0]["coordinate_accuracy"], "unresolved", "coordinate_accuracy도 unresolved로 낮춰야 함")


def test_enforce_region_confirmed_keeps_success_with_matched_regions() -> None:
    """지역이 확정된(matched_recruitment_regions가 있는) success 행은
    그대로 유지해야 한다 — 이 안전장치가 정상 success까지 막으면 안 됨."""
    rows = [{
        "raw_address": "Some Building, Some Street", "lat": 10.0, "lng": 106.0,
        "geocode_status": "success", "coordinate_accuracy": "ward",
        "matched_recruitment_regions": ["Hà Nội"], "source_verified": False,
        "address_evidence": "2 variants converged",
    }]

    result = _enforce_region_confirmed_before_success(rows)

    assert_equal(result[0]["geocode_status"], "success", "지역이 확정된 success는 그대로 유지돼야 함")
    assert_equal(result[0]["lat"], 10.0, "좌표를 지우면 안 됨")
    assert_equal(result[0]["lng"], 106.0, "좌표를 지우면 안 됨")


def test_enforce_region_confirmed_does_not_touch_non_success_rows() -> None:
    """failed/pending 행은 matched_recruitment_regions와 무관하게 그대로
    통과해야 한다 — 이 안전장치는 오직 'success인데 지역 미확정'인 경우만 잡는다."""
    rows = [
        {"geocode_status": "failed", "lat": None, "lng": None, "matched_recruitment_regions": []},
        {"geocode_status": "pending", "lat": None, "lng": None, "matched_recruitment_regions": []},
    ]

    result = _enforce_region_confirmed_before_success(rows)

    assert_equal(result, rows, "success가 아닌 행은 전혀 건드리면 안 됨")


def test_location_candidates_returns_empty_when_no_location_section() -> None:
    """근무지 섹션 자체가 비어 있으면(원문에 "Địa điểm làm việc" 내용이
    없음) 빈 목록을 반환해야 한다 — 예외 없이, 임의 위치를 만들어내지 않고."""
    candidates = _vietnamworks_location_candidates([])
    assert_equal(candidates, [], "근무지 정보가 없으면 빈 목록이어야 함")


def main() -> int:
    tests = [
        test_single_address_case_qorvo_senior_cad_engineer,
        test_multi_location_case_spx_giam_sat_matches_title,
        test_title_field_mismatch_case_spx_area_operations_manager,
        test_title_extra_region_detected_when_province_is_recognized,
        test_enforce_region_confirmed_downgrades_success_without_matched_regions,
        test_enforce_region_confirmed_keeps_success_with_matched_regions,
        test_enforce_region_confirmed_does_not_touch_non_success_rows,
        test_location_candidates_returns_empty_when_no_location_section,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} VietnamWorks extraction tests passed")
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

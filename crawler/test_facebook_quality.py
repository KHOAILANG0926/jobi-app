"""Offline tests for Facebook crawler parsing quality."""

from __future__ import annotations

from crawl_facebook import (
    extract_company,
    extract_district,
    extract_salary,
    is_job_post,
    is_ambiguous_job,
    parse_post,
)


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def assert_true(value, label: str) -> None:
    if not value:
        raise AssertionError(label)


def assert_false(value, label: str) -> None:
    if value:
        raise AssertionError(label)


def test_non_job_money_post() -> None:
    text = "Tôi nhiều tiền quá, muốn công đức thì sợ người ta bảo rửa tiền. 1 tháng tôi trả 100 triệu"
    assert_false(is_job_post(text), "money/scam-like non-job should be skipped")


def test_ambiguous_generic_post_skipped() -> None:
    job = parse_post({"text": "TUYỂN NHÂN SỰ\nKhông yêu cầu bằng cấp.\nThu nhập không giới hạn.", "location": "Hà Nội"})
    assert_true(is_ambiguous_job(job), "generic recruitment without role should be ambiguous")


def test_restaurant_and_salary_with_combining_marks() -> None:
    text = "Quán nhậu cần tuyển\n1/phụ bếp có kinh nghiệm\nLương : 8 triệu đến 12 triệu tuỳ năng lực"
    job = parse_post({"text": text, "location": "Đà Nẵng"})
    assert_equal(job["category"], "restaurant", "combining-mark restaurant text should classify")
    assert_equal(job["salary"], "8 triệu", "salary should not be blank")
    assert_false(is_ambiguous_job(job), "clear restaurant role should be allowed")


def test_company_does_not_capture_benefit_sentence() -> None:
    text = "E cần tuyển gấp 5nv làm tạp vụ lau hành lang chung cư 423 Minh Khai\nCông ty có hỗ trợ chỗ ở cho nhân viên ở quê xa"
    assert_equal(extract_company(text), "", "benefit sentence should not be company")


def test_company_from_recruitment_heading() -> None:
    text = "TUẤN ĐỨC POOL ARENA - BẮC NINH TUYỂN DỤNG\nVị trí : 2NV nam, nữ"
    assert_equal(extract_company(text), "TUẤN ĐỨC POOL ARENA - BẮC NINH", "company from heading")


def test_district_pattern_does_not_match_plain_letter_p() -> None:
    text = "Làm ngồi, phòng thường\nđộ tuổi từ 18 đến 45\nđịa chỉ tại Vsip - Bắc Ninh"
    assert_equal(extract_district(text), "", "plain p in Vietnamese words must not become location")


def test_salary_keeps_month_suffix() -> None:
    assert_equal(extract_salary("8.5 – 10tr/tháng"), "8.5 – 10tr/tháng", "salary month suffix")


def main() -> int:
    tests = [
        test_non_job_money_post,
        test_ambiguous_generic_post_skipped,
        test_restaurant_and_salary_with_combining_marks,
        test_company_does_not_capture_benefit_sentence,
        test_company_from_recruitment_heading,
        test_district_pattern_does_not_match_plain_letter_p,
        test_salary_keeps_month_suffix,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} facebook quality tests passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"❌ {exc}")
        raise SystemExit(1)

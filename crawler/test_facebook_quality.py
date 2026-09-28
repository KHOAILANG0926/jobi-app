"""Offline tests for Facebook crawler parsing quality."""

from __future__ import annotations

from datetime import datetime

from crawl_facebook import (
    classify_page_signals,
    extract_company,
    extract_post_id,
    merge_seen_keys,
    parse_time_label,
    post_key,
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
    # 2026-09-24: parse_post()는 classify() 결과를 map_to_new_taxonomy()로
    # 변환한 새 13분류 id를 돌려준다("restaurant"는 옛 7분류라 여기선 절대
    # 안 나옴) — 이 fixture가 map_to_new_taxonomy() 도입 전 옛 값으로
    # 남아있던 stale 케이스였다(job_quality.VALID_CATEGORIES와 같은 버그
    # 클래스는 아니고, 단순히 갱신 안 된 테스트 기대값).
    assert_equal(job["category"], "am_thuc_do_uong", "combining-mark restaurant text should classify")
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


NOW = datetime(2026, 9, 28, 12, 0)


def test_post_id_from_permalink() -> None:
    url = "https://www.facebook.com/groups/timvieclamthembacninh/posts/1437419115190226/"
    assert_equal(extract_post_id(url), "1437419115190226", "numeric post id")
    assert_equal(extract_post_id("https://www.facebook.com/permalink.php?story_fbid=pfbid0abc&id=1"), "pfbid0abc", "story_fbid")
    assert_equal(post_key({"postUrl": url, "text": "x"}), "id:1437419115190226", "key prefers id")


def test_post_key_without_link_is_stable_text_hash() -> None:
    a = post_key({"postUrl": "", "text": "Cần tuyển  phục vụ\nLương 8tr"})
    b = post_key({"postUrl": "", "text": "cần tuyển phục vụ lương 8tr"})
    assert_true(a.startswith("h:"), "hash fallback")
    assert_equal(a, b, "whitespace/case-insensitive hash")


def test_time_label_relative() -> None:
    assert_equal(parse_time_label("방금", NOW)["precision"], "minute", "ko just now")
    assert_equal(parse_time_label("3시간", NOW)["estimate"], "2026-09-28T09:00", "ko hours")
    assert_equal(parse_time_label("15 phút", NOW)["estimate"], "2026-09-28T11:45", "vi minutes")
    assert_equal(parse_time_label("Hôm qua lúc 14:20", NOW)["precision"], "day", "vi yesterday")
    assert_equal(parse_time_label("2d", NOW)["estimate"], "2026-09-26T12:00", "en days")
    assert_equal(parse_time_label("1주", NOW)["precision"], "week", "ko week")


def test_time_label_absolute_dates() -> None:
    assert_equal(parse_time_label("9월 20일 오후 3:15", NOW)["estimate"], "2026-09-20T00:00", "ko date not N일")
    assert_equal(parse_time_label("12월 30일", NOW)["estimate"], "2025-12-30T00:00", "future date -> last year")
    assert_equal(parse_time_label("20 tháng 9", NOW)["estimate"], "2026-09-20T00:00", "vi date")
    assert_equal(parse_time_label("September 20, 2025", NOW)["estimate"], "2025-09-20T00:00", "en date")


def test_time_label_unknown_is_none() -> None:
    assert_equal(parse_time_label("", NOW), None, "empty")
    assert_equal(parse_time_label("Nhóm công khai", NOW), None, "not a time label")


def test_page_state_classification() -> None:
    feed = "https://www.facebook.com/groups/x"
    assert_equal(classify_page_signals(feed, True, True, "댓글 달기 좋아요 log in"), "ok",
                 "korean feed with a stray 'log in' word is not a login wall")
    assert_equal(classify_page_signals("https://www.facebook.com/checkpoint/123", True, False, ""), "checkpoint", "checkpoint url")
    assert_equal(classify_page_signals(feed, True, False, "Vui lòng xác minh danh tính của bạn"), "checkpoint", "checkpoint text")
    assert_equal(classify_page_signals("https://www.facebook.com/login/?next=x", True, False, ""), "session_expired", "login url")
    assert_equal(classify_page_signals(feed, False, True, ""), "session_expired", "c_user cookie cleared")
    assert_equal(classify_page_signals(feed, True, False, "Đăng nhập"), "anomaly", "logged in but no feed")


def test_merge_seen_keys_newest_first_and_capped() -> None:
    merged = merge_seen_keys(["id:1", "id:2", "id:3"], ["id:9", "id:2"], limit=3)
    assert_equal(merged, ["id:9", "id:2", "id:1"], "new first, dedup, cap")


def main() -> int:
    tests = [
        test_non_job_money_post,
        test_ambiguous_generic_post_skipped,
        test_restaurant_and_salary_with_combining_marks,
        test_company_does_not_capture_benefit_sentence,
        test_company_from_recruitment_heading,
        test_district_pattern_does_not_match_plain_letter_p,
        test_salary_keeps_month_suffix,
        test_post_id_from_permalink,
        test_post_key_without_link_is_stable_text_hash,
        test_time_label_relative,
        test_time_label_absolute_dates,
        test_time_label_unknown_is_none,
        test_page_state_classification,
        test_merge_seen_keys_newest_first_and_capped,
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

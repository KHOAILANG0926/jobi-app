"""Offline quality tests for crawler classification and payload shaping."""

from __future__ import annotations

import sys

from classifier import classify, is_blacklisted
from job_quality import (
    canonical_job_key,
    compute_job_updates,
    extract_salary_from_text,
    guess_all_provinces_from_text,
    guess_province_from_text,
    guess_work_location_provinces,
    has_excluded_money_terms,
    is_expired,
    looks_like_location,
    normalize_location,
    normalize_salary,
    parse_listing_card_lines,
    split_work_locations,
    validate_job_payload,
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


def test_classifier() -> None:
    cases = [
        ("Nhân Viên Pha Chế Highlands Coffee", "Highlands", "", "cafe"),
        ("Phụ Bếp Nhà Hàng Hải Sản", "Quán Hải Sản 999", "", "restaurant"),
        ("Phục Vụ Bàn Jollibee Part-time", "Jollibee", "", "restaurant"),
        ("Thu Ngân Siêu Thị WinMart", "WinCommerce", "", "retail"),
        ("Nhân Viên Bán Hàng Cửa Hàng Tiện Lợi", "Circle K", "", "retail"),
        ("Công Nhân Sản Xuất Nhà Máy", "Samsung Bắc Ninh", "", "factory"),
        ("Nhân Viên Đóng Gói KCN Bình Dương", "ABC Mfg", "", "factory"),
        ("Tài Xế Giao Hàng GrabFood", "Grab", "", "delivery"),
        ("Nhân Viên Kho Part-time", "Lazada", "", "delivery"),
        ("Nhân Viên Vệ Sinh Văn Phòng", "CleanPro", "", "cleaning"),
        ("Giúp Việc Nhà Bán Thời Gian", "", "", "cleaning"),
        ("Nhân Viên Nhập Liệu Part-time", "Cty ABC", "", "office"),
        ("Trực Tổng Đài CSKH Ca Tối", "Call Center 24h", "", "office"),
        ("Telesale Part-time Buổi Tối", "Edu Online", "", "office"),
        ("Admin Bán Hàng Trực Page Facebook", "Shop Online", "", "office"),
        ("Lễ Tân Văn Phòng Part-time", "Spa ABC", "", "office"),
        ("Senior Developer Python", "Tech Co", "", "other"),
        ("Giám Đốc Kinh Doanh", "Corp X", "", "other"),
        ("Kế Toán Trưởng", "Tập Đoàn Y", "", "other"),
        ("Nhân Viên Sale Cửa Hàng Tiện Lợi", "GS25", "", "retail"),
    ]
    for title, company, description, expected in cases:
        assert_equal(classify(title, company, description), expected, title)

    assert_true(is_blacklisted("Senior Developer Python", "Tech Co"), "senior developer should be blacklisted")
    assert_false(is_blacklisted("Nhân Viên Nhập Liệu Part-time", "Cty ABC"), "entry office work should not be blacklisted")


def test_quality_helpers() -> None:
    assert_equal(normalize_salary("  Thoả thuận  "), "Thỏa thuận", "salary agreement")
    assert_equal(normalize_salary("300 triệu/tháng"), "Thỏa thuận", "unrealistic salary cap")
    assert_equal(normalize_salary("8 - 12 triệu/tháng"), "8 - 12 triệu/tháng", "normal salary")
    assert_equal(
        extract_salary_from_text("Quyền lợi: Thu nhập từ 8 - 12 triệu/tháng + phụ cấp"),
        "Thu nhập từ 8 - 12 triệu/tháng",
        "salary extracted from detail text",
    )
    assert_equal(normalize_location("Địa điểm: Bình Dương"), "Bình Dương", "location prefix")
    assert_true(is_expired("2026-08-21", today="2026-08-22"), "expired deadline")
    assert_false(is_expired("2026-08-23", today="2026-08-22"), "future deadline")
    assert_equal(
        canonical_job_key("Nhân viên Đóng gói!!!", "Công ty Ánh Dương"),
        canonical_job_key("Nhan vien dong goi", "Cong ty Anh Duong"),
        "canonical key removes accents and punctuation",
    )
    assert_true(
        has_excluded_money_terms("Theo dõi đơn hàng và quản lý, thu hồi công nợ theo quy định công ty."),
        "debt collection jobs should be excluded",
    )
    assert_false(
        has_excluded_money_terms("Nhân viên bán hàng cửa hàng tiện lợi, nhận ca linh hoạt."),
        "normal retail jobs should remain allowed",
    )


def test_payload_validation() -> None:
    good_job = {
        "title": "Nhân Viên Đóng Gói KCN Bình Dương",
        "company": "Công ty Ánh Dương",
        "location": "Bình Dương",
        "salary": "8 - 12 triệu/tháng",
        "description": "[source:vieclam24h] ## Mô tả công việc\nĐóng gói hàng hóa",
        "category": "factory",
        "posted_at": "2026-08-22",
        "urgent": False,
        "employer_phone": "",
        "application_deadline": "2026-09-01",
        "active": True,
        "origin": "crawler",
        "admin_hidden": False,
        "image_url": None,
    }
    assert_equal(validate_job_payload(good_job, today="2026-08-22"), [], "good payload")

    bad_job = {**good_job, "description": "missing source", "category": "security"}
    errors = validate_job_payload(bad_job, today="2026-08-22")
    assert_true("missing source tag: vieclam24h" in errors, "missing source tag error")
    assert_true("invalid category: security" in errors, "invalid category error")

    expired_job = {**good_job, "application_deadline": "2026-08-22"}
    assert_true("deadline is expired" in validate_job_payload(expired_job, today="2026-08-22"), "expired job error")

    debt_job = {
        **good_job,
        "title": "NV Kinh Doanh Tôn Thép",
        "description": "[source:vieclam24h] Theo dõi đơn hàng, quản lý và thu hồi công nợ theo quy định công ty.",
        "category": "retail",
    }
    assert_true(
        "excluded money/debt collection job" in validate_job_payload(debt_job, today="2026-08-22"),
        "debt collection payload error",
    )


def test_work_locations() -> None:
    # Regression fixture for local_jobs id 3981 (Vieclam24h original) — this is
    # the exact raw text captured live from the real detail page's DOM via
    # fetch_job_detail's generic section walker (no <li> tags in this section,
    # so no "• " bullets; each row is "<province>:<address>" with no space
    # around the colon). The QTSC Building 1 company HQ address lives under a
    # different heading and is never part of this text.
    section_3981 = (
        "TP.HCM:OfficeHaus, 32 Tân Thắng, Phường Tân Sơn Nhì, Tân Phú\n"
        "TP.HCM:Onehub Saigon Tower 1 - Đường D1, Khu Công Nghệ Cao, "
        "Phường Tăng Nhơn Phú, Thủ Đức"
    )
    locations = split_work_locations(section_3981)
    assert_equal(len(locations), 2, "job 3981 must yield exactly 2 work locations")
    assert_equal(
        locations[0],
        "OfficeHaus, 32 Tân Thắng, Phường Tân Sơn Nhì, Tân Phú",
        "job 3981 location 1",
    )
    assert_equal(
        locations[1],
        "Onehub Saigon Tower 1 - Đường D1, Khu Công Nghệ Cao, Phường Tăng Nhơn Phú, Thủ Đức",
        "job 3981 location 2",
    )
    assert_true(
        not any("QTSC" in loc for loc in locations),
        "job 3981 must never include the QTSC Building 1 company HQ address",
    )

    # Re-running on the same input must be stable (idempotent regression check).
    assert_equal(
        split_work_locations(section_3981),
        locations,
        "job 3981 result must stay stable across repeated runs",
    )

    # Non-list single-paragraph address still yields exactly one location.
    assert_equal(
        split_work_locations("123 Đường Lê Lợi, Phường Bến Nghé, Quận 1"),
        ["123 Đường Lê Lợi, Phường Bến Nghé, Quận 1"],
        "single-paragraph address",
    )

    # Boilerplate-only / empty section yields no fabricated location.
    assert_equal(split_work_locations("Xem bản đồ"), [], "map CTA noise filtered out")
    assert_equal(split_work_locations(""), [], "empty section yields no locations")
    assert_equal(split_work_locations(None), [], "missing section yields no locations")

    # Duplicate bullets collapse to one entry.
    assert_equal(
        split_work_locations("• 1 Đường A, Quận 1\n• 1 Đường A, Quận 1"),
        ["1 Đường A, Quận 1"],
        "duplicate bullets deduplicated",
    )

    # Regression fixture for local_jobs id 4311 (Unilever Củ Chi wastewater
    # operator, vieclam24h) — the exact raw text captured live from the real
    # detail page's "Địa điểm làm việc" section. This is a company shuttle-bus
    # pickup-point list (one plant, five pickup districts), not five distinct
    # work sites — treating each line as its own work location would fabricate
    # 4 fake workplaces. All 5 lines must be dropped, yielding no locations at
    # all (never a partial/guessed subset).
    section_4311 = (
        "TP.HCM:xe đưa đón, Củ Chi\n"
        "TP.HCM:xe đưa đón, Thủ Đức\n"
        "TP.HCM:xe đưa đón, Quận 5\n"
        "TP.HCM:xe đưa đón, Quận 1\n"
        "TP.HCM:xe đưa đón, Quận 7"
    )
    assert_equal(
        split_work_locations(section_4311),
        [],
        "job 4311 shuttle pickup-point list must yield zero fabricated work locations",
    )

    # A shuttle-pickup line mixed into an otherwise-real list must only drop
    # the shuttle line, not the genuine address next to it.
    assert_equal(
        split_work_locations("TP.HCM:xe đưa đón, Quận 1\nTP.HCM:456 Đường Cách Mạng Tháng 8, Quận 3"),
        ["456 Đường Cách Mạng Tháng 8, Quận 3"],
        "shuttle pickup line filtered out even when mixed with a real address",
    )


def test_compute_job_updates() -> None:
    existing = {
        "id": 3981,
        "title": "Nhân Viên Hành Chính Nhắc Phí Tại Văn Phòng",
        "company": "Công Ty TNHH Vietnam Concentrix Services",
        "salary": "9 - 25 triệu",
        "application_deadline": "2026-09-02",
        "description": "[source:vieclam24h] ## Mô tả công việc\nGọi điện thoại...",
        "location": "Hồ Chí Minh",
    }

    # Nothing changed → no fields to update at all.
    unchanged_job = {**existing}
    assert_equal(compute_job_updates(existing, unchanged_job), {}, "no change yields empty update dict")

    # Only the deadline moved — only that one field should be in the result,
    # not salary/description/location which stayed identical.
    deadline_changed = {**existing, "application_deadline": "2026-09-10"}
    assert_equal(
        compute_job_updates(existing, deadline_changed),
        {"application_deadline": "2026-09-10"},
        "deadline-only change isolates that field",
    )

    # Multiple tracked fields changed at once.
    multi_changed = {
        **existing,
        "salary": "10 - 20 triệu",
        "location": "Bình Dương",
    }
    assert_equal(
        compute_job_updates(existing, multi_changed),
        {"salary": "10 - 20 triệu", "location": "Bình Dương"},
        "multiple changed fields all included",
    )

    # A re-scrape that yields None for a field (e.g. deadline missing this
    # time) must never be treated as "cleared it out" — None is ignored, the
    # existing value is left alone.
    none_value_job = {**existing, "application_deadline": None}
    assert_equal(
        compute_job_updates(existing, none_value_job),
        {},
        "new None value never overwrites an existing value",
    )

    # title/company/category are the matching key / not tracked at all — even
    # if a caller's job dict carries different values for them, they must
    # never leak into the update payload.
    with_untracked_fields = {**existing, "title": "Different Title", "category": "retail"}
    assert_equal(
        compute_job_updates(existing, with_untracked_fields),
        {},
        "title/category are never part of the update payload",
    )


def test_parse_listing_card_lines() -> None:
    # Regression fixture for local_jobs id 4094: a "Không cần CV" badge line
    # rendered before the real title on this card, so title/company used to
    # swap. This is the exact real card text, reconstructed live from the
    # actual vieclam24h listing (see title-badge investigation).
    badge_first = [
        'Không cần CV',
        'Giám Sát Kỹ Thuật Hiện Trường (Cấp Thoát Nước)',
        'Công Ty TNHH Điện Bảo An',
        '12 - 16 triệu',
        'TP.HCM',
        'Còn 22 ngày',
    ]
    result = parse_listing_card_lines(badge_first)
    assert_equal(result['title'], 'Giám Sát Kỹ Thuật Hiện Trường (Cấp Thoát Nước)', 'badge line skipped for title')
    assert_equal(result['company'], 'Công Ty TNHH Điện Bảo An', 'real title no longer bumped into company')

    # Other confirmed badge lines are skipped the same way.
    assert_equal(
        parse_listing_card_lines(['HOT', 'Nhân Viên Bán Hàng', 'Công Ty ABC'])['title'],
        'Nhân Viên Bán Hàng',
        '"HOT" badge skipped',
    )
    assert_equal(
        parse_listing_card_lines(['Tin ưu tiên', 'Nhân Viên Kho', 'Công Ty XYZ'])['title'],
        'Nhân Viên Kho',
        '"Tin ưu tiên" badge skipped',
    )

    # Regression fixture for local_jobs id 3665: the title itself mentions a
    # city ("... _ Hà Nội") and the card has no separate location line — the
    # title line must never be picked as location just because it contains a
    # city name.
    title_has_city = ['Nhân Viên Kỹ Thuật _ Hà Nội', 'Công Ty Cổ Phần Thương Mại & Dịch Vụ TTC Việt Nam', '8 - 12 triệu']
    result = parse_listing_card_lines(title_has_city)
    assert_equal(result['title'], 'Nhân Viên Kỹ Thuật _ Hà Nội', 'title kept as-is')
    assert_equal(result['location'], '', 'no separate location line -> location stays empty, not the title')

    # A card with a real, separate location line still finds it correctly —
    # excluding the title from the search doesn't break the normal case.
    normal = ['Nhân Viên Bán Hàng Siêu Thị', 'Công Ty CP Bán Lẻ ABC', '8 - 10 triệu', 'Hồ Chí Minh', 'Còn 10 ngày']
    result = parse_listing_card_lines(normal)
    assert_equal(result['location'], 'Hồ Chí Minh', 'separate location line still found')

    # Regression fixture for local_jobs id 3981: no badge line, has its own
    # separate location line — the fix must not change this at all (no badge
    # among the first lines, so title/company/location come out identical to
    # before this fix).
    job_3981 = [
        'Nhân Viên Hành Chính Nhắc Phí Tại Văn Phòng',
        'Công Ty TNHH Vietnam Concentrix Services',
        '9 - 25 triệu',
        'Hồ Chí Minh',
        'HOT',
        'Tin ưu tiên',
        'Không cần CV',
        'Còn 4 ngày',
    ]
    result = parse_listing_card_lines(job_3981)
    assert_equal(result['title'], 'Nhân Viên Hành Chính Nhắc Phí Tại Văn Phòng', '3981: title unchanged')
    assert_equal(result['company'], 'Công Ty TNHH Vietnam Concentrix Services', '3981: company unchanged')
    assert_equal(result['location'], 'Hồ Chí Minh', '3981: location unchanged')


def test_normalize_location_province_fallback() -> None:
    # sb-4312 회귀 테스트: 리스트 카드에서 지역을 못 찾아 location이 빈 값으로
    # 들어와도, 예전처럼 무조건 fallback 대도시(Hồ Chí Minh)로 대체하지 않고
    # 제목/상세 텍스트에서 실제 지역명(Hưng Yên처럼 8대도시 밖의 지역 포함)을
    # 다시 찾아야 한다.
    assert_equal(
        normalize_location(
            "",
            detail_text="Kỹ Thuật Viên Bảo Trì Hệ Thống Xử Lý Nước [Hưng Yên] Công ty TNHH ABC",
        ),
        "Hưng Yên",
        "sb-4312 style: empty listing location falls back to province guessed from title",
    )
    assert_equal(
        normalize_location("", detail_text="Nhân viên kho tại KCN Yên Phong, Bắc Ninh"),
        "Bắc Ninh",
        "location guessed from detail 'Địa điểm làm việc' section text",
    )
    # 상세 텍스트에도 알려진 지역명이 전혀 없을 때만 fallback 대도시를 쓴다.
    assert_equal(
        normalize_location("", detail_text="Không có thông tin địa điểm cụ thể"),
        "",
        "no province found anywhere -> empty (unknown), never a guessed default city",
    )
    # 리스트 카드에서 이미 값을 찾았으면 detail_text는 무시하고 그 값을 그대로 쓴다.
    assert_equal(
        normalize_location("Đà Nẵng", detail_text="Công ty ở Hưng Yên"),
        "Đà Nẵng",
        "non-empty listing location takes priority over detail_text guess",
    )
    assert_equal(guess_province_from_text("Nhà máy tại Hưng Yên, gần KCN"), "Hưng Yên", "guess_province_from_text finds province")
    assert_true(guess_province_from_text("không có địa danh nào ở đây") is None, "guess_province_from_text returns None when nothing matches")


def test_location_validation_and_multi_province() -> None:
    # sb-4313 회귀 테스트: 리스트 카드가 location에 제목 전체를 그대로 넘겨도
    # (빈 값이 아니어도) 그걸 그대로 믿지 말고 무효 처리해야 한다.
    title = "Kho Shopee - Nhân Viên Kho Xử Lý Hàng Hóa Bắc Ninh / Bình Dương / Long An / Đà Nẵng (Lên Đến 15 Triệu*)"
    assert_false(looks_like_location(title, title=title), "full title must not pass as a location")
    assert_false(looks_like_location("9 - 15 triệu", salary="9 - 15 triệu"), "salary text must not pass as a location")
    assert_false(looks_like_location("Công Ty TNHH Spx Express", company="Công Ty TNHH Spx Express"), "company name must not pass as a location")
    assert_true(looks_like_location("Bắc Ninh"), "a real short place name should pass")
    assert_true(looks_like_location("Bắc Ninh", title=title), "place name substring of title is still a valid location itself")

    assert_equal(
        normalize_location(title, detail_text=title, title=title, company="", salary=""),
        "Bắc Ninh",
        "sb-4313 style: title-as-location is rejected, falls back to first province guessed from title",
    )

    # "Bình Dương" is intentionally not in LISTING_CITY_KEYWORDS — it's not one of
    # the current canonical provinces in src/data/jobRegions.ts (2025 administrative
    # merger absorbed it elsewhere), so it's correctly left unrecognized here too.
    provinces = guess_all_provinces_from_text(title)
    assert_equal(provinces, ["Bắc Ninh", "Long An", "Đà Nẵng"], "all recognized provinces found, in text order, no duplicates")
    assert_equal(guess_all_provinces_from_text("Làm việc tại TPHCM"), ["Hồ Chí Minh"], "TPHCM abbreviation recognized")
    assert_equal(guess_all_provinces_from_text("không có địa danh nào"), [], "no provinces found -> empty list")


def test_work_location_context_filtering() -> None:
    # 요구사항 1: 설명에 출장지/교육 장소/복지 여행/회사 주소가 있어도 근무지로
    # 채택하지 않아야 한다 — "làm việc tại" 같은 근무지 문맥이 없는 문장에서
    # 지역을 뽑으면 안 된다.
    title = "Nhân Viên Kinh Doanh"
    description = (
        "## Mô tả công việc\n"
        "• Chăm sóc khách hàng tại văn phòng công ty\n"
        "## Quyền lợi\n"
        "• Du lịch hàng năm tại Đà Nẵng, Nha Trang\n"
        "• Đào tạo tại Hà Nội cho nhân viên mới\n"
        "• Công ty có trụ sở tại Hồ Chí Minh\n"
    )
    assert_equal(
        guess_work_location_provinces(title, description),
        [],
        "business trip / training / company HQ mentions must not be adopted as work locations",
    )

    # 반대로 실제 근무지 문맥이 있으면 정상적으로 채택되어야 한다 (sb-4309 회귀).
    real_work_desc = "- Làm việc tại các dự án công trình mà công ty đang thi công (Long An, Đồng Nai)."
    assert_equal(
        guess_work_location_provinces("Kỹ Sư Cơ Điện", real_work_desc),
        ["Long An", "Đồng Nai"],
        "an explicit work-location sentence (làm việc tại ...) is still recognized",
    )

    # 제목에 지역이 여러 개 나열되면(사실상 근무지 목록) 그대로 신뢰한다 — 근무지
    # 문맥 문구가 본문에 따로 없어도 된다 (sb-4313 회귀).
    multi_title = "Kho Shopee - Nhân Viên Kho Xử Lý Hàng Hóa Bắc Ninh / Long An / Đà Nẵng"
    assert_equal(
        guess_work_location_provinces(multi_title, ""),
        ["Bắc Ninh", "Long An", "Đà Nẵng"],
        "provinces enumerated directly in the title are trusted without needing a context phrase",
    )


def test_unknown_location_never_defaults_to_a_city() -> None:
    # 요구사항 2: 지역 정보가 전혀 없을 때 Hồ Chí Minh(또는 다른 대도시)으로
    # 대체하지 않는다 — 빈 문자열("알 수 없음")을 그대로 반환해야 한다.
    no_info_job = {
        "title": "Nhân Viên Văn Phòng",
        "company": "Công Ty ABC",
        "location": normalize_location(
            "", detail_text="Không có thông tin địa điểm cụ thể",
            title="Nhân Viên Văn Phòng", company="Công Ty ABC", salary="Thỏa thuận",
        ),
        "salary": "Thỏa thuận",
        "description": "[source:vieclam24h] test",
        "category": "office",
        "origin": "crawler",
        "active": True,
        "admin_hidden": False,
        "application_deadline": "2099-01-01",
    }
    assert_equal(no_info_job["location"], "", "no location info anywhere -> empty, not a guessed city")
    # 빈 location이 저장을 막는 사유가 되지 않아야 한다(더 이상 "location is missing" 거부 없음).
    errors = validate_job_payload(no_info_job, source="vieclam24h", today="2026-01-01")
    assert_false(
        any("location" in e for e in errors),
        "empty/unknown location must not be rejected by validate_job_payload",
    )


def test_exact_address_takes_priority_over_approximate() -> None:
    # 요구사항 4: 실제(구조화된) 주소가 있으면 그것을 우선하고, 여러 지역명 근사
    # 처리로 덮어쓰지 않는다 — crawl_topcv.py의 `if not work_locations:` 가드와
    # 동일한 우선순위를 여기서도 검증한다.
    detail_section = "• 71 Trần Trọng Cung, Phường Tân Thuận Đông, Quận 7, Hồ Chí Minh"
    exact_addresses = split_work_locations(detail_section)
    assert_true(len(exact_addresses) > 0, "structured 'Địa điểm làm việc' section yields a real address")

    title = "Tài Xế - Hà Nội / Hồ Chí Minh"
    desc_text = "Làm việc tại các depot ở Hà Nội và Hồ Chí Minh."
    # crawl_topcv.py's own guard: only fall back to province-guessing when no
    # structured addresses were already found.
    work_locations = exact_addresses if exact_addresses else guess_work_location_provinces(title, desc_text)
    assert_equal(work_locations, exact_addresses, "exact structured address list wins; approximate province guessing is never consulted")


def main() -> int:
    tests = [
        test_classifier, test_quality_helpers, test_payload_validation,
        test_work_locations, test_compute_job_updates, test_parse_listing_card_lines,
        test_normalize_location_province_fallback, test_location_validation_and_multi_province,
        test_work_location_context_filtering, test_unknown_location_never_defaults_to_a_city,
        test_exact_address_takes_priority_over_approximate,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} job quality tests passed")
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

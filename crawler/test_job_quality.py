"""Offline quality tests for crawler classification and payload shaping."""

from __future__ import annotations

import sys

from classifier import classify, is_blacklisted
from job_quality import (
    canonical_job_key,
    extract_salary_from_text,
    has_excluded_money_terms,
    is_expired,
    normalize_location,
    normalize_salary,
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


def main() -> int:
    tests = [test_classifier, test_quality_helpers, test_payload_validation]
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

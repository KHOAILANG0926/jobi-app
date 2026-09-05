"""Offline quality tests for crawler classification and payload shaping."""

from __future__ import annotations

import sys

from classifier import classify
from job_quality import (
    canonical_job_key,
    classify_work_location_candidate,
    compute_all_locations_c1_verified,
    compute_job_updates,
    extract_salary_from_text,
    extract_work_days_free_text,
    extract_work_hours_free_text,
    gate_auto_publish,
    guess_all_provinces_from_text,
    guess_province_from_text,
    guess_work_location_provinces,
    has_application_path,
    has_excluded_money_terms,
    is_expired,
    looks_like_location,
    normalize_location,
    normalize_salary,
    parse_listing_card_lines,
    find_education_badge,
    pick_detail_company_name,
    split_work_locations,
    strip_salary_badge_label,
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

    # 2026-09-05 사용자 지시로 제거: classifier.is_blacklisted()가 직급
    # (팀장/부장/이사/대표)·전문성(IT/법률/의료/교육/부동산)만으로 정상
    # 공고를 수집 단계에서 제외하던 실사례 오제외(vieclam24h-new10-
    # independent.zip 표본에서 발견 — "Kế Toán Trưởng" 2건, "Trưởng Phòng
    # Kinh Doanh..." 1건)를 고쳤다. is_blacklisted() 자체가 crawl_topcv.py
    # 에서 삭제됐으므로 이 위치의 관련 단정문도 제거한다 — "Senior
    # Developer Python"/"Kế Toán Trưởng" 등이 여전히 category='other'로
    # 분류되는지는 위 cases에서 이미 확인됨(수집 제외가 아니라 카테고리
    # 분류일 뿐). 실제 수집 제외 여부는 crawl_topcv.py --dry-run-urls로
    # 실제 3개 URL을 재확인해 검증(순수 함수 레벨에서는 더 이상 테스트할
    # is_blacklisted 로직이 없음).


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
    # 2026-09-05 사용자 지시로 정정(vieclam24h-blind-10 독립검증에서 표본
    # 3/4/8 오탐 실사례 발견): "công nợ"가 본문(description)에만 있고
    # 제목/직종에 추심 전담 어근 조합이 없으면 더 이상 제외 근거가 아니다
    # — 주문·납품·영업·회계 업무의 일반적인 일부(theo dõi/quản lý/đối chiếu/
    # thu hồi + công nợ)로 허용한다. 이 텍스트는 실제 title이 아니라
    # description 위치에서 검사돼야 새 정책의 의미가 맞다.
    assert_false(
        has_excluded_money_terms(description="Theo dõi đơn hàng và quản lý, thu hồi công nợ theo quy định công ty."),
        "'thu hồi công nợ' in description only (not title/category) must now be ALLOWED — normal order/sales/accounting duty",
    )
    assert_false(
        has_excluded_money_terms(description="Nhân viên bán hàng cửa hàng tiện lợi, nhận ca linh hoạt."),
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

    # 2026-09-05 사용자 지시로 정정(실사례 오탐 — vieclam24h-blind-10 독립검증
    # 표본 3): 제목이 일반 영업직이고 "thu hồi công nợ"가 본문에만(주문·납품
    # 업무의 일부로) 있으면 더 이상 제외되면 안 된다. 이 fixture는 표본 3의
    # 실제 모양(철강 영업, 제목에 추심 언어 없음, 본문에 "quản lý, thu hồi
    # công nợ")을 그대로 축소 재현한다.
    normal_sales_job_with_debt_mention_in_body = {
        **good_job,
        "title": "NV Kinh Doanh Tôn Thép",
        "description": "[source:vieclam24h] Theo dõi đơn hàng, quản lý và thu hồi công nợ theo quy định công ty.",
        "category": "retail",
    }
    errors_for_normal_sales = validate_job_payload(normal_sales_job_with_debt_mention_in_body, today="2026-08-22")
    assert_true(
        not any(e.startswith("excluded money/debt collection job") for e in errors_for_normal_sales),
        f"title has no debt-collection stems and 'công nợ' is only in the body -> must NOT be excluded, got errors={errors_for_normal_sales!r}",
    )

    # 실제 추심 전담 공고는 제목 자체에 어근 조합이 있으므로 계속 제외돼야 한다.
    real_debt_collector_job = {
        **good_job,
        "title": "Nhân Viên Thu Hồi Nợ",
        "description": "[source:vieclam24h] Gọi điện nhắc khách hàng thanh toán khoản vay quá hạn.",
        "category": "office",
    }
    errors_for_collector = validate_job_payload(real_debt_collector_job, today="2026-08-22")
    assert_true(
        any(e.startswith("excluded money/debt collection job") for e in errors_for_collector),
        f"title itself is a dedicated debt-collector role ('Thu Hồi Nợ') -> must still be excluded, got errors={errors_for_collector!r}",
    )


def test_debt_collection_quality_filter_fix() -> None:
    """2026-09-05 사용자 지시 — vieclam24h-blind-10.zip 독립검증에서 발견된
    3건의 실제 오제외(표본 3/4/8)를 고정 fixture로 재현하고, 정정된 규칙
    (title/category에서만 어근 조합 검사, description은 절대 근거로 안 씀)
    이 그 3건은 통과시키면서 진짜 추심 전담 공고 3건(제목 자체에 어근 조합이
    있음)은 여전히 막는지 확인한다. 특정 표본 번호/URL/회사명을 예외처리하는
    코드가 아니라 job_quality.py의 공통 규칙만으로 이 결과가 나와야 한다."""

    def _minimal_job(title: str, description: str, category: str = "office") -> dict:
        return {
            "title": title,
            "company": "Công Ty TNHH Test",
            "location": "TP.HCM",
            "salary": "10 - 15 triệu",
            "description": f"[source:vieclam24h] {description}",
            "category": category,
            "posted_at": "2026-09-05",
            "urgent": False,
            "employer_phone": "0901234567",
            "application_deadline": "2026-09-30",
            "active": True,
            "origin": "crawler",
            "admin_hidden": False,
            "image_url": None,
        }

    def _assert_not_money_excluded(job: dict, label: str) -> None:
        errors = validate_job_payload(job, today="2026-09-05")
        assert_true(
            not any(e.startswith("excluded money/debt collection job") for e in errors),
            f"{label}: must NOT be excluded, got errors={errors!r}",
        )

    def _assert_money_excluded(job: dict, label: str) -> None:
        errors = validate_job_payload(job, today="2026-09-05")
        assert_true(
            any(e.startswith("excluded money/debt collection job") for e in errors),
            f"{label}: must be excluded, got errors={errors!r}",
        )

    # ── 실제 오탐 3건(vieclam24h-blind-10.zip crawler_dry_run.json에서 그대로
    # 가져온 title/category/description — 요약·교정 없음) ──
    sample_3 = _minimal_job(
        "Nhân Viên Kinh Doanh Tôn Thép - Không Yêu Cầu Kinh Nghiệm - Lương Cứng Upto 10Tr",
        "Theo dõi đơn hàng, tiến độ giao hàng, phối hợp xử lý các vấn đề phát sinh và quản lý, thu hồi công nợ theo quy định công ty.",
        category="retail",
    )
    _assert_not_money_excluded(sample_3, "sample_3 (steel sales, 'thu hồi công nợ' only in body)")

    sample_4 = _minimal_job(
        "Chuyên Viên Kinh Doanh Phụ Gia & Nguyên Liệu Thực Phẩm",
        "Báo giá, đàm phán, ký kết hợp đồng và theo dõi đơn hàng, công nợ",
        category="office",
    )
    _assert_not_money_excluded(sample_4, "sample_4 (food additive sales, 'công nợ' only in body)")

    sample_8 = _minimal_job(
        "Kế Toán Tổng Hợp",
        "Theo dõi và quản lý công nợ",
        category="office",
    )
    _assert_not_money_excluded(sample_8, "sample_8 (general accountant, 'quản lý công nợ' only in body)")

    # ── 제목 자체가 추심 전담인 경우는 계속 제외돼야 한다(고정 테스트) ──
    _assert_money_excluded(
        _minimal_job("Nhân viên thu hồi nợ", "Công việc văn phòng thông thường."),
        "title='Nhân viên thu hồi nợ'",
    )
    _assert_money_excluded(
        _minimal_job("Chuyên viên xử lý nợ xấu", "Công việc văn phòng thông thường."),
        "title='Chuyên viên xử lý nợ xấu'",
    )
    _assert_money_excluded(
        _minimal_job("Cộng tác viên nhắc nợ khoản vay", "Công việc văn phòng thông thường."),
        "title='Cộng tác viên nhắc nợ khoản vay'",
    )

    # ── 제목은 일반 영업/사무직이고 본문에만 công nợ가 있는 합성 케이스
    # (실 표본과 별개로, 규칙 자체를 직접 확인) ──
    _assert_not_money_excluded(
        _minimal_job("Nhân viên kinh doanh khu vực", "Đối chiếu và theo dõi công nợ khách hàng hàng tháng."),
        "generic sales title, 'đối chiếu/theo dõi công nợ' only in body",
    )

    # ── "đối"(대조, 허용)와 "đòi"(독촉, 제외) ascii_key 충돌 방지 확인 —
    # "đối chiếu công nợ"가 제목에 있어도 오제외되면 안 된다(둘 다
    # ascii_key 정규화 후 "doi"가 되므로, 근접거리를 좁게 잡아 구분해야 함).
    _assert_not_money_excluded(
        _minimal_job("Nhân viên đối chiếu công nợ", "Thực hiện đối chiếu số liệu công nợ với khách hàng."),
        "title='Nhân viên đối chiếu công nợ' (đối/reconcile, not đòi/collect) must NOT be excluded",
    )

    # ── 실사례 회귀(2026-09-05, GPT 독립검증 — vieclam24h-new10-independent.zip
    # 표본 2에서 실제 발견된 오제외): "Xử Lý Nước [Hà Nội]"(수처리 시스템 유지
    # 보수)가 ascii_key 정규화 후 "xu ly nuoc ha noi"가 되는데, 예전 코드는
    # target "no"를 부분 문자열로만 찾아 "Hà Nội" → "ha noi"의 앞 두 글자
    # "no"(사실은 "nội"의 일부)에 우연히 걸려 "xu ly...no"로 오판정했다 —
    # "nợ"(빚)와 아무 관련 없는 "Hà Nội"라는 지명일 뿐이다. 독립 단어 경계
    # 없이 부분 문자열만 보던 설계 결함이 원인.
    _assert_not_money_excluded(
        _minimal_job(
            "Kỹ Thuật Viên Bảo Trì Hệ Thống Xử Lý Nước [Hà Nội]",
            "Bảo trì, vận hành hệ thống xử lý nước thải, nước cấp cho nhà máy.",
        ),
        "title='Kỹ Thuật Viên Bảo Trì Hệ Thống Xử Lý Nước [Hà Nội]' — "
        "'Xử lý nước'/'Hà Nội' must NOT collide with the 'nợ' root as a substring",
    )
    _assert_not_money_excluded(
        _minimal_job("Kỹ Sư Vận Hành Hệ Thống Xử Lý Nước Thải", "Vận hành hệ thống xử lý nước thải công nghiệp."),
        "title contains 'xử lý nước thải' (wastewater treatment) — must NOT be excluded",
    )
    _assert_not_money_excluded(
        _minimal_job("Nhân Viên Kinh Doanh Khu Vực Hà Nội", "Chăm sóc khách hàng khu vực Hà Nội."),
        "title contains plain 'Hà Nội' as a location — must NOT be excluded",
    )

    # ── 이 수정 이후에도 실제 추심 전담 제목은 계속 제외돼야 한다(사용자
    # 지시로 명시된 전체 목록, 부분 문자열이 아닌 단어경계 매칭으로도 여전히
    # 잡혀야 함) ──
    _assert_money_excluded(
        _minimal_job("Chuyên viên xử lý nợ", "Công việc văn phòng thông thường."),
        "title='Chuyên viên xử lý nợ' (no 'xấu' suffix) must still be excluded",
    )
    _assert_money_excluded(
        _minimal_job("Nhân viên nhắc nợ", "Công việc văn phòng thông thường."),
        "title='Nhân viên nhắc nợ' must still be excluded",
    )
    _assert_money_excluded(
        _minimal_job("Field Collection Specialist", "Công việc văn phòng thông thường."),
        "title='Field Collection Specialist' must still be excluded",
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


def test_address_pipeline_standard() -> None:
    """Tests for the general classify -> gate pipeline (job_quality.py's
    classify_work_location_candidate / has_application_path / gate_auto_publish).
    These are the standard applied to EVERY job — no id/company branching
    anywhere in job_quality.py or crawl_topcv.py. local_jobs id 4366/4367/4368
    (kept after the bulk local_jobs cleanup) supply 3 of the fixtures below,
    used purely as real-world regression DATA — not as special-cased code."""

    # 'exact' — specific, named places (house number / KCN / street / tower).
    exact_cases = [
        "OfficeHaus, 32 Tân Thắng, Phường Tân Sơn Nhì, Tân Phú",  # job 3981
        "Onehub Saigon Tower 1 - Đường D1, Khu Công Nghệ Cao, Phường Tăng Nhơn Phú, Thủ Đức",  # job 3981
        "KCN Sóng Thần 1, Dĩ An, Bình Dương (cũ)., Dĩ An",  # job 4366
        "17 Phạm Hùng, Nam Từ Liêm",  # job 4367
        "262 Nguyễn Văn Tạo, Hiệp Phước (Nhà Bè cũ), Nhà Bè",  # job 4368
        "Lô A2-3 KCN Tây Bắc Củ Chi, Xã Tân An Hội, Huyện Củ Chi",  # job 4311 company plant addr shape
        "Cụm CN Tập Đoàn Anova, Xã Long Cang, Cần Đước",  # id 4379 — "Cụm CN" (space-separated abbreviation) regression
        "CCN Tân Quy, Xã Đông Thạnh, Hóc Môn",  # concatenated "CCN" abbreviation, no other signal
        "Nhà máy Vĩnh Phúc, Xã Sơn Lôi, Huyện Bình Xuyên",  # named facility type, no digit/street/KCN
        "Bệnh viện Đa Khoa Tâm Trí, Sài Gòn",
        "Cửa hàng Bách Hoá Xanh, Quận Bình Tân",
        "Siêu thị Coopmart, Biên Hòa",
    ]
    for addr in exact_cases:
        assert_equal(classify_work_location_candidate(addr), "exact", f"should classify exact: {addr!r}")

    # 'region_only' — real administrative names, but no specific site.
    region_cases = [
        "Dĩ An, Bình Dương (cũ)., Thủ Đức",  # job 4366's second, unnamed line
        "Hồ Chí Minh",
        "Quận 1, TP.HCM",
        "Huyện Củ Chi, TP Hồ Chí Minh",
        # 고정 테스트 #15 (2026-09-05 사용자 지시): 일반 시설 단어 하나만
        # 행정구역명에 붙어 있고 실제 고유명사가 없으면, 특정 공고/회사명을
        # 예외처리하는 게 아니라 이 공통 규칙 자체로 region_only로 남아야
        # 한다(과대 분류 금지) — 텍스트 자체는 삭제하지 않고 지역 수준
        # 위치로 보존된다(resolve_work_locations()가 이제 region_only도
        # 행으로 만든다, address_accuracy='region_only').
        "Cửa hàng, Hà Nội",
        "Nhà máy, Bình Dương",
        "Xưởng, Long An",
    ]
    for addr in region_cases:
        assert_equal(classify_work_location_candidate(addr), "region_only", f"should classify region_only: {addr!r}")

    # 'undetermined' — too short / no recognizable place signal at all.
    undetermined_cases = ["abc", "N/A", "  "]
    for addr in undetermined_cases:
        assert_equal(classify_work_location_candidate(addr), "undetermined", f"should classify undetermined: {addr!r}")

    # has_application_path: true with any ONE of phone/zalo/source_url; false with none.
    assert_true(has_application_path("0901234567", "", ""), "phone alone is an application path")
    assert_true(has_application_path("", "https://zalo.me/0901234567", ""), "zalo alone is an application path")
    assert_true(has_application_path("", "", "https://vieclam24h.vn/abc.html"), "source_url alone is an application path")
    assert_false(has_application_path("", "", ""), "no phone/zalo/source_url -> no application path")
    assert_false(has_application_path(None, None, None), "None values -> no application path")

    # gate_auto_publish: 2026-09-05 최종 제품 정책(2026-09-04 "모든 근무지
    # C1 검증 필수" 정책을 사용자 지시로 대체) — 공개 가능 = 유효한 지원
    # 경로 + 근무지 또는 모집지역 정보가 하나 이상 존재. 좌표 검증 여부는
    # 더 이상 게이트가 아니다(has_location_or_region만 있으면 되고, 좌표
    # 정확도/검증 인자 자체가 함수 시그니처에서 빠졌다).
    assert_equal(
        gate_auto_publish(True, True), (True, "ok"),
        "location-or-region info + application path -> publish, regardless of coordinate verification",
    )
    assert_equal(
        gate_auto_publish(False, True), (False, "no_address_text"),
        "no location/region info at all -> held",
    )
    assert_equal(
        gate_auto_publish(True, False), (False, "no_application_path"),
        "no application path -> held even with location/region info",
    )
    assert_equal(
        gate_auto_publish(False, False), (False, "no_address_text"),
        "neither -> held, location/region checked first",
    )

    # 고정 테스트 #1 (2026-09-05): 성·시만 있음 + 지원 경로 있음 → 공개.
    province_only_candidates = ["Hồ Chí Minh"]
    assert_equal(
        [classify_work_location_candidate(c) for c in province_only_candidates], ["region_only"],
        "a bare province name classifies region_only, not exact",
    )
    should_publish_province, reason_province = gate_auto_publish(
        has_location_or_region=True,  # region_only 후보도 이제 resolved_locations에 행으로 남는다(resolve_work_locations() 참고)
        has_application_path_=has_application_path("0901234567", "", ""),
    )
    assert_true(should_publish_province, "province-only location + valid application path must publish")
    assert_equal(reason_province, "ok", "publish reason must be ok")

    # 고정 테스트 #2 (2026-09-05): 구·군·동만 있음 + 지원 경로 있음 → 공개.
    district_only_candidates = ["Huyện Củ Chi, TP Hồ Chí Minh"]
    assert_equal(
        [classify_work_location_candidate(c) for c in district_only_candidates], ["region_only"],
        "a bare district/ward chain classifies region_only, not exact",
    )
    should_publish_district, reason_district = gate_auto_publish(
        has_location_or_region=True,
        has_application_path_=has_application_path("", "https://zalo.me/0901234567", ""),
    )
    assert_true(should_publish_district, "district-only location + valid application path must publish")
    assert_equal(reason_district, "ok", "publish reason must be ok")

    # 고정 테스트 #5 (2026-09-05): 모집지역만 있음(근무지 후보 자체가 0건) +
    # 지원 경로 있음 → 공개. crawl_topcv._compute_job_recruitment_regions()
    # 자체의 계산 로직은 test_address_pipeline_integration.py의
    # test_compute_job_recruitment_regions_survives_zero_work_location_rows가
    # 검증한다(이 파일은 crawl_topcv/geocode에 의존하지 않는 offline 테스트
    # 라 여기서는 그 결과를 그대로 흉내낸 리스트만 쓴다) — 여기서 확인할
    # 것은 gate_auto_publish()가 "근무지 행 0건"이어도 "모집지역 정보 있음"
    # 쪽 OR만으로 공개시킨다는 점이다.
    resolved_work_location_rows: list[dict] = []  # 근무지 후보 자체가 0건
    recruitment_regions_only = ["TP.HCM", "Long An"]  # 원문 어딘가 언급된 지역명만으로 채워진 경우
    should_publish_region_only, reason_region_only = gate_auto_publish(
        has_location_or_region=len(resolved_work_location_rows) > 0 or len(recruitment_regions_only) > 0,
        has_application_path_=True,
    )
    assert_true(should_publish_region_only, "recruitment-regions-only (zero work-location rows) + valid application path must publish")
    assert_equal(reason_region_only, "ok", "publish reason must be ok")

    # 고정 테스트 #6 (2026-09-05): 근무지와 모집지역 모두 없음 → 비공개.
    should_publish_nothing, reason_nothing = gate_auto_publish(
        has_location_or_region=len([]) > 0 or len([]) > 0,
        has_application_path_=True,
    )
    assert_false(should_publish_nothing, "zero work-location rows AND zero recruitment regions -> must never publish")
    assert_equal(reason_nothing, "no_address_text", "held reason must be no_address_text")

    # 고정 테스트 #7 (2026-09-05): 위치 있음(성·시만이라도) + 지원 경로 없음 → 비공개.
    should_publish_no_apply, reason_no_apply = gate_auto_publish(
        has_location_or_region=True,
        has_application_path_=has_application_path("", "", ""),
    )
    assert_false(should_publish_no_apply, "location/region info present but no phone/zalo/source_url -> must never publish")
    assert_equal(reason_no_apply, "no_application_path", "held reason must be no_application_path")

    # 'no_verified_coordinate'는 gate_auto_publish()가 더 이상 반환하지 않는다
    # — DB CHECK에는 과거 데이터 호환을 위해서만 남아있다(migration 0017).
    # 위 모든 분기(publish/no_address_text/no_application_path)를 이미
    # 직접 값으로 확인했으므로 — 이 함수가 반환할 수 있는 reason은 오직
    # 그 3가지뿐임을 아래에서 한 번 더 총괄로 확인한다.
    for has_loc in (True, False):
        for has_app in (True, False):
            _, reason = gate_auto_publish(has_loc, has_app)
            assert_true(
                reason in ("ok", "no_address_text", "no_application_path"),
                f"gate_auto_publish({has_loc}, {has_app}) reason must be one of ok/no_address_text/no_application_path, got {reason!r} — 'no_verified_coordinate' must never be returned by the new policy",
            )

    # End-to-end on the 3 regression fixtures (4366/4367/4368) — classification only,
    # geocoding itself is exercised separately (it needs network + writes to
    # geocode_cache, out of scope for this offline test suite).
    job_4366_candidates = ["KCN Sóng Thần 1, Dĩ An, Bình Dương (cũ)., Dĩ An", "Dĩ An, Bình Dương (cũ)., Thủ Đức"]
    exact_4366 = [c for c in job_4366_candidates if classify_work_location_candidate(c) == "exact"]
    assert_equal(len(exact_4366), 1, "job 4366 must resolve to exactly 1 exact candidate, not 2 (2nd line is region_only)")
    assert_true(
        gate_auto_publish(True, True)[0],
        "job 4366 with real address text + source_url -> would publish",
    )

    job_4367_candidates = ["17 Phạm Hùng, Nam Từ Liêm"]
    assert_equal(
        [classify_work_location_candidate(c) for c in job_4367_candidates], ["exact"],
        "job 4367's single address must classify exact",
    )

    job_4368_candidates = ["262 Nguyễn Văn Tạo, Hiệp Phước (Nhà Bè cũ), Nhà Bè"]
    assert_equal(
        [classify_work_location_candidate(c) for c in job_4368_candidates], ["exact"],
        "job 4368's single address must classify exact",
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


def test_detail_page_company_and_salary_extraction() -> None:
    # 실측 fixture — 2026-09-04, vieclam24h.vn 실제 공고 10건에서 확인된 회사명/
    # 급여 추출 결함의 회귀 테스트. --dry-run-urls로 10건 전수 비교한 결과,
    # 회사명은 10건 중 9건이 사이트 자체가 "..."로 자른 축약 텍스트로 잘못
    # 저장됐고(첫 번째 -ntd 링크만 썼기 때문 — 실제 전체 회사명은 하단 회사 정보
    # 블록의 링크에만 있음), 급여는 10건 중 7건이 상세페이지 "Mức lương" 배지값과
    # 다르거나 아예 "Thỏa thuận"으로 잘못 대체됐다(본문 자유 텍스트 정규식만 썼기
    # 때문). 아래는 그 10건 중 대표 사례를 그대로 옮긴 것 — 특정 공고 id를
    # 코드에서 분기하지 않고, 공통 파서(pick_detail_company_name/
    # strip_salary_badge_label)로 전부 통과해야 한다.
    real_company_candidate_lists = [
        (["Công Ty Cổ Phần Dịch ...", "", "Công Ty Cổ Phần Dịch Vụ Bảo Vệ Sao Vàng Fb", "Xem trang công ty"],
         "Công Ty Cổ Phần Dịch Vụ Bảo Vệ Sao Vàng Fb"),
        (["Công Ty TNHH Dịch Vụ ...", "", "Công Ty TNHH Dịch Vụ Bảo Vệ Vincom", "Xem trang công ty"],
         "Công Ty TNHH Dịch Vụ Bảo Vệ Vincom"),
        (["Công Ty Cổ Phần Chè ...", "", "Công Ty Cổ Phần Chè Thành Ngọc", "Xem trang công ty"],
         "Công Ty Cổ Phần Chè Thành Ngọc"),
        (["Công Ty TNHH DV Nha ...", "", "Công Ty TNHH DV Nha Khoa Sài Gòn Hoàn Mỹ", "Xem trang công ty"],
         "Công Ty TNHH DV Nha Khoa Sài Gòn Hoàn Mỹ"),
        (["Công Ty TNHH Ốc Vít ...", "", "Công Ty TNHH Ốc Vít Bảo Chứng", "Xem trang công ty"],
         "Công Ty TNHH Ốc Vít Bảo Chứng"),
        # 축약되지 않은 짧은 상호는 첫 후보가 이미 전체 이름이므로 그대로 유지.
        (["Dntn Khách Sạn Tràng An", "", "Dntn Khách Sạn Tràng An", "Xem trang công ty"],
         "Dntn Khách Sạn Tràng An"),
        # 후보 전부가 "..."로 끝나는 극단적인 경우 — 첫 후보로 안전하게 폴백.
        (["Công Ty ABC ...", "Công Ty ABC ..."], "Công Ty ABC ..."),
        ([], ""),
    ]
    for candidates, expected in real_company_candidate_lists:
        assert_equal(pick_detail_company_name(candidates), expected, f"company candidates {candidates!r}")

    real_salary_badges = [
        ("Mức lương7.5 - 9 triệu", "7.5 - 9 triệu"),
        ("Mức lương9 - 20 triệu", "9 - 20 triệu"),
        ("Mức lương6 - 8 triệu", "6 - 8 triệu"),
        ("Mức lương11 - 13 triệu", "11 - 13 triệu"),
        ("", ""),
    ]
    for raw, expected in real_salary_badges:
        assert_equal(strip_salary_badge_label(raw), expected, f"salary badge {raw!r}")

    # 실측 fixture — "Trình độ" 배지는 배지 행에만 있고(표에는 없음), 일부
    # 공고는 이 배지 자체가 아예 없다(학력 요건이 없다는 뜻 — 원문 누락이지
    # 파서 실패가 아니다).
    real_badge_rows = [
        (["Mức lương7.5 - 9 triệu", "Khu vực tuyểnTP.HCM", "Kinh nghiệm1 năm", "Trình độKhông yêu cầu"], "Không yêu cầu"),
        (["Mức lương9 - 20 triệu", "Khu vực tuyểnQuảng Ninh", "Kinh nghiệmChưa có kinh nghiệm"], ""),
        (["Mức lương11 - 13 triệu", "Khu vực tuyểnTP.HCM", "Kinh nghiệmChưa có kinh nghiệm", "Trình độKhông yêu cầu"], "Không yêu cầu"),
    ]
    for badges, expected in real_badge_rows:
        assert_equal(find_education_badge(badges), expected, f"badge row {badges!r}")


def test_extract_work_hours_free_text_preserves_split_shifts() -> None:
    # 실측 회귀(2026-09-04, 사용자 지시 — 신규 20건 블라인드 시험 14번 공고
    # "Kỹ Sư Kỹ Thuật Điện (M&E)"에서 발견): 오전/오후 분할 근무가 한 문장에
    # 시간 범위 2개로 적혀 있는데(g 플래그 없는 단일 매치 정규식이) 앞쪽
    # ("7h - 11h")만 잡고 뒤쪽("Chiều: 12h - 16h")을 통째로 버렸다. 실제 원문
    # 그대로 두 범위 모두 보존해야 한다.
    real_desc = "- Thời gian làm việc: từ thứ 2 - thứ 7  (Sáng: 7h - 11h, Chiều: 12h - 16h)."
    result = extract_work_hours_free_text(real_desc)
    assert_true("7h - 11h" in result, f"morning shift must survive: {result!r}")
    assert_true("12h - 16h" in result, f"afternoon shift must not be dropped: {result!r}")
    assert_equal(result, "Sáng: 7h - 11h, Chiều: 12h - 16h", "both shifts joined, each keeping its Sáng/Chiều label")

    # 단일 근무시간(분할 아님)은 기존과 동일하게 그 하나만 반환돼야 한다 —
    # 회귀 수정이 정상 케이스를 깨지 않았는지 확인.
    assert_equal(
        extract_work_hours_free_text("Có thể làm việc xoay ca (ca sáng 5-13H, ca chiều 13-21H, ca tối 15-23H)."),
        "",
        "non-'Hh' hour formats (e.g. '5-13H' without the lowercase h-before-digits shape) are out of scope — must stay empty, not fabricate a match",
    )
    assert_equal(
        extract_work_hours_free_text("Làm việc 8h - 17h các ngày trong tuần."),
        "8h - 17h",
        "a single plain time range (no Sáng/Chiều label) still extracts correctly",
    )
    assert_equal(extract_work_hours_free_text(""), "", "empty description -> empty (not found), not fabricated")
    assert_equal(extract_work_hours_free_text(None), "", "None description -> empty, never raises")


def test_hours_and_work_days_extraction_fix() -> None:
    """2026-09-05 사용자 지시 — vieclam24h-blind-10.zip 독립검증에서 발견된
    표본 4/8/9의 hours=null/work_days=null(또는 불완전) 실패를 그 공고들의
    실제 "Mô tả công việc" 원문(source_dom.json/crawler_dry_run.json에서
    그대로 가져온 문장 — 요약·교정 없음)으로 재현하고, 정정된 정규식이
    원문에 적힌 시간/요일 정보를 소실 없이 담아내는지 확인한다. 적혀 있지
    않은 정보(휴무 사유, 교대조 의미 등)를 새로 만들어내지 않았는지도
    함께 확인한다."""
    # 표본 4 — "Mô tả công việc"의 실제 근무시간 문장 3줄(DOM 순서 그대로).
    sample_4_desc = (
        "Thứ Hai – Thứ Sáu: 08:00 – 17:00\n"
        "Thứ Bảy: 08:00 – 12:00\n"
        "Nghỉ trưa: 12:00 – 13:00"
    )
    s4_hours = extract_work_hours_free_text(sample_4_desc)
    s4_days = extract_work_days_free_text(sample_4_desc)
    assert_true(s4_hours != "", "sample_4: hours must not be empty")
    assert_true("08:00" in s4_hours and "17:00" in s4_hours, f"sample_4: hours must preserve 'Thứ Hai – Thứ Sáu: 08:00 – 17:00', got {s4_hours!r}")
    assert_true("12:00" in s4_hours, f"sample_4: hours must preserve Saturday's '08:00 – 12:00', got {s4_hours!r}")
    assert_true(s4_days != "", "sample_4: work_days must not be empty")
    assert_true("Thứ Hai" in s4_days and "Thứ Sáu" in s4_days, f"sample_4: work_days must preserve the Mon-Fri range, got {s4_days!r}")
    assert_true("Thứ Bảy" in s4_days, f"sample_4: work_days must preserve Saturday, got {s4_days!r}")

    # 표본 8 — 실제 원문 3줄(라벨 "Thời gian làm việc:"은 별도 문단, 시간/
    # 요일 정보는 그 아래 li 3개).
    sample_8_desc = (
        "08h00 – 17h00, nghỉ trưa 1 tiếng\n"
        "Nghỉ chiều Thứ 7 & Chủ nhật\n"
        "Tăng ca nếu làm ngày lễ, cuối tuần : 200% lương cơ bản"
    )
    s8_hours = extract_work_hours_free_text(sample_8_desc)
    s8_days = extract_work_days_free_text(sample_8_desc)
    assert_true("08h00" in s8_hours and "17h00" in s8_hours, f"sample_8: hours must preserve '08h00 – 17h00', got {s8_hours!r}")
    assert_true("Thứ 7" in s8_days, f"sample_8: work_days must preserve Saturday afternoon off, got {s8_days!r}")
    assert_true("Chủ nhật" in s8_days, f"sample_8: work_days must preserve Sunday off, got {s8_days!r}")

    # 표본 9 — 실제 원문(단일 문장, "Thời gian làm việc:" 라벨 + 시간 +
    # 요일 + 점심시간 + 일요일 휴무가 한 문장에 전부 있음).
    sample_9_desc = (
        "Thời gian làm việc: Từ 08:30 đến 20:00, thứ Hai đến thứ Bảy "
        "(nghỉ trưa từ 12:00 đến 14:00, nghỉ ngày Chủ nhật)."
    )
    s9_hours = extract_work_hours_free_text(sample_9_desc)
    s9_days = extract_work_days_free_text(sample_9_desc)
    assert_true("08:30" in s9_hours and "20:00" in s9_hours, f"sample_9: hours must preserve '08:30 đến 20:00', got {s9_hours!r}")
    assert_true("thứ Hai" in s9_days and "thứ Bảy" in s9_days, f"sample_9: work_days must preserve 'thứ Hai đến thứ Bảy', got {s9_days!r}")
    assert_true("Chủ nhật" in s9_days, f"sample_9: work_days must preserve Sunday off, got {s9_days!r}")

    # 추측 금지 확인: 세 표본 원문 어디에도 "교대조"/"buổi sáng"(표본 4의
    # 토요일 줄에는 실제로 없음) 같은 단어가 없으므로, 출력에도 나타나면
    # 안 된다 — 있지도 않은 의미를 새로 만들어 붙이지 않았는지 직접 확인.
    assert_true("buổi sáng" not in s4_days, f"sample_4: 'buổi sáng' is not in the source text for Saturday — must not be invented, got {s4_days!r}")
    assert_true("ca " not in s4_hours.lower(), f"sample_4: source never mentions shifts ('ca') — must not invent shift wording, got {s4_hours!r}")

    # 점심 휴게시간 오분류 방지: "Nghỉ trưa: 12:00 – 13:00" /
    # "nghỉ trưa từ 12:00 đến 14:00"은 휴게시간이지 근무시간이 아니므로
    # hours에 섞여 들어가면 안 된다(자체 재검증 중 발견 — 처음 수정에서는
    # 이 구분 없이 모든 숫자 범위를 hours로 잡아 실패했었다).
    assert_true("13:00" not in s4_hours, f"sample_4: lunch break '12:00 – 13:00' must not be misclassified as work hours, got {s4_hours!r}")
    assert_true("14:00" not in s9_hours, f"sample_9: lunch break '12:00 đến 14:00' must not be misclassified as work hours, got {s9_hours!r}")


def test_compute_all_locations_c1_verified_requires_every_location_source_verified() -> None:
    # 2026-09-04 사용자 지시로 만들어진 compute_all_locations_c1_verified()의
    # 순수 계산 로직 자체(coordinate_accuracy가 아니라 source_verified
    # 필드만 봄)는 2026-09-05 공개 게이트 정책 전환 이후로도 그대로다 — 단지
    # 더 이상 gate_auto_publish()에 들어가지 않을 뿐, 지도 표시 등급/거리검색
    # 자격 판단에는 여전히 쓰인다(job_quality.compute_all_locations_
    # c1_verified() docstring 참고). 엔드투엔드(실제 resolve_work_locations()
    # 경로) 버전은 test_address_pipeline_integration.py의
    # test_gate_publishes_partially_verified_mixed_tiers /
    # test_gate_publishes_regardless_of_coordinate_verification_tier 참고
    # (이름이 바뀐 이유도 동일 — 이제는 "공개해야 함"을 검증한다).
    assert_true(
        compute_all_locations_c1_verified([{"coordinate_accuracy": "exact_candidate", "source_verified": True}]),
        "single location, source-verified -> True",
    )
    assert_true(
        compute_all_locations_c1_verified([
            {"coordinate_accuracy": "exact_candidate", "source_verified": True},
            {"coordinate_accuracy": "exact_candidate", "source_verified": True},
        ]),
        "multiple locations, all source-verified -> True",
    )
    assert_false(
        compute_all_locations_c1_verified([
            {"coordinate_accuracy": "exact_candidate", "source_verified": True},
            {"coordinate_accuracy": "ward", "source_verified": False},
        ]),
        "one source-verified + one ward (C1_partial) -> False, not all locations verified",
    )
    assert_false(
        compute_all_locations_c1_verified([
            {"coordinate_accuracy": "ward", "source_verified": False},
            {"coordinate_accuracy": "exact_candidate", "source_verified": True},
        ]),
        "order must not matter -> still False when any single location is not source-verified",
    )
    assert_false(
        compute_all_locations_c1_verified([]),
        "zero resolved locations -> False (no address text at all, never vacuously True)",
    )
    assert_false(
        compute_all_locations_c1_verified([{"coordinate_accuracy": "unresolved", "source_verified": False}]),
        "single location, unresolved -> False",
    )
    # 핵심 회귀(2026-09-04, 2차 지시): coordinate_accuracy=='exact_candidate'
    # 여도 source_verified가 False면(Geoapify만 성공, 원문 좌표 검증 없음)
    # C1로 인정하지 않는다 — 이게 바로 이번 강화 지시의 핵심.
    assert_false(
        compute_all_locations_c1_verified([{"coordinate_accuracy": "exact_candidate", "source_verified": False}]),
        "exact_candidate tier alone (Geoapify self-convergence, no source verification) must NOT count as C1",
    )
    assert_false(
        compute_all_locations_c1_verified([{"coordinate_accuracy": "exact_candidate"}]),
        "source_verified missing entirely (old-shape row) -> treated as not verified, never vacuously True",
    )


def main() -> int:
    tests = [
        test_classifier, test_quality_helpers, test_payload_validation,
        test_debt_collection_quality_filter_fix,
        test_work_locations, test_address_pipeline_standard, test_compute_job_updates,
        test_parse_listing_card_lines,
        test_normalize_location_province_fallback, test_location_validation_and_multi_province,
        test_work_location_context_filtering, test_unknown_location_never_defaults_to_a_city,
        test_exact_address_takes_priority_over_approximate,
        test_detail_page_company_and_salary_extraction,
        test_extract_work_hours_free_text_preserves_split_shifts,
        test_hours_and_work_days_extraction_fix,
        test_compute_all_locations_c1_verified_requires_every_location_source_verified,
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

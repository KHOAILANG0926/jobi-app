"""Offline tests for Facebook crawler parsing quality."""

from __future__ import annotations

from datetime import datetime

from crawl_facebook import (
    classify_page_signals,
    clean_text,
    extract_company,
    extract_post_id,
    evaluate_post,
    filter_new_jobs,
    load_seen_state,
    miss_risk,
    order_consistency,
    stall_decision,
    write_json_atomic,
    is_self_promotion,
    is_truncated_post,
    merge_seen_keys,
    missing_required,
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


SEEKER_POST_20260928 = """EM NHẬN LAU NHÀ Ạ – AI CẦN THÌ ỦNG HỘ EM!
Mình ở Kinh Bắc, Bắc Ninh, chuyên nhận lau dọn nhà cửa.
Mình không ngại nhà nhiều việc, miễn là mình thống nhất công việc trước.
 Lau sàn
 Vệ sinh bếp
 Cọ nhà vệ sinh
Mình tự mang đầy đủ dụng cụ . làm cẩn thận và có trách nhiệm.
 Zalo: 0988741119
Mọi người biết ai đang cần người lau dọn thì giới thiệu giúp em với ạ. Em cảm ơn cả nhà rất nhiều!"""


def test_self_promotion_seeker_posts_rejected() -> None:
    # 실제 2026-09-28 DRY-RUN에서 통과했던 글: "cần người"로 구인 키워드엔 걸림
    assert_true(is_job_post(SEEKER_POST_20260928), "fixture reproduces the keyword hit")
    assert_true(is_self_promotion(SEEKER_POST_20260928), "cleaning self-promo is not a job ad")
    assert_true(is_self_promotion("Em đang cần tìm việc làm ca tối ạ, ai biết chỗ nào giới thiệu giúp em với"), "job seeker")
    assert_true(is_self_promotion("Mình nhận giúp việc theo giờ khu Kinh Bắc, ai cần liên hệ 0912345678"), "maid service offer")


def test_self_promotion_keeps_real_job_ads() -> None:
    employer_posts = [
        "Quán em cần người phụ bếp, lương 8tr, liên hệ 0912345678",
        "Bạn nào đang tìm việc làm thêm thì inbox mình, bên mình cần 3 bạn đóng gói 25k/giờ",
        "Cần tuyển 2 bạn nữ lau dọn nhà, lương 7 triệu/tháng, Zalo 0988000111",
        "Em cần tuyển gấp 5nv làm tạp vụ lau hành lang chung cư 423 Minh Khai",
        "Quán nhậu cần tuyển\n1/phụ bếp có kinh nghiệm\nLương : 8 triệu đến 12 triệu tuỳ năng lực",
        "Mình cần tìm 2 bạn phục vụ quán cafe ca tối, 22k/h, nhận hồ sơ qua Zalo",
    ]
    for text in employer_posts:
        assert_false(is_self_promotion(text), f"employer post must pass: {text[:40]}")


def test_agency_wage_post_detected_and_non_jobs_unchanged() -> None:
    # 2026-09-29 VPS dry-run에서 '구인글 아님'으로 오판된 실제 글(전화번호만 가짜로 교체)
    agency = "Cty Khvatec Qv1 - Tan ca tt luôn,\nNgày 350, Đêm 380,\nCn ngày 500, Cn đêm 550,\nTuần 350 - 400 - 550 - 600,\nZl: 0900000000."
    assert_true(is_job_post(agency), "factory shift-wage ad without 'tuyển' is a job post")
    # 같은 실행의 나머지 7건(실제 본문, 전화번호 가짜) — 계속 비구인이어야 함
    non_jobs = [
        "LH sdt e 0900000001 có cả Zalo hoặc inbox mình ạ\n_ Quán em bán đồ ăn vặt, mỳ cay , trà sữa , đồ nhậu ạ. e có đầy đủ nhé:\n_ Mỳ cay - bún đậu - nem nướng -mỳ xào - đồ ăn vặt ....",
        "Mình nhận thu muaa điện thoại cũ hỏng giá cao từ 500-5 triệu lấy tận nơi nhé ai có quăng vô đây nào …",
        "Mọi người thử đoán xem món này là gì?",
        "KHAI GIẢNG LỚP TIẾNG TRUNG CHO NGƯỜI MỚI BẮT ĐẦU\nBạn muốn học tiếng Trung nhưng chưa biết bắt đầu từ đâu?",
        "THANH LÍ VECPA TRẮNG GIÁ RẺ \n ĐỦ ĐK\n GIÁ HỌC SINH\nHỖ CHỢ TRẢ GÓP.\nLH\n 0900000002\nGIANG LIỄU.QUẾ VÕ.BĂC Ninh",
        "Mình nhận thu muaa điện thoại cũ hỏng giá cao lấy tận nơi nhé ai có quăng vô đây nào …",
        "Tin vui ai có điện thoại cũ hỏng mình nhận mua giá cao lấy tận nơi ai có quăng vô đây nào …",
    ]
    for t in non_jobs:
        assert_false(is_job_post(t), f"still not a job post: {t[:40]}")
    # 좁은 조건: 회사 표시·교대 금액 2개·연락처 중 하나라도 빠지면 인정하지 않음
    assert_false(is_job_post("Ngày 350, Đêm 380, Zl: 0900000000"), "no employer marker -> not detected")
    assert_false(is_job_post("Cty ABC ngày 350, Zl: 0900000000"), "only one shift wage -> not detected")
    assert_false(is_job_post("Cty ABC Ngày 350, Đêm 380"), "no contact -> not detected")


def test_clean_text_strips_see_less_toggle() -> None:
    raw = "Hotline: 0966 361 896\nĐịa điểm làm việc: [ TDP Tăng Quang, Phường Việt Yên ] 적게 보기"
    assert_true(not clean_text(raw).endswith("적게 보기"), "Korean see-less removed")
    assert_true(clean_text("Liên hệ 0911111111\nẨn bớt").endswith("0911111111"), "Vietnamese see-less removed")


def test_stall_ends_only_after_consecutive_no_progress() -> None:
    # 2026-09-28 HCM: 요소 합계 15 고정, 채움 4<->6 진동 — 빈 칸은 '로딩 중'이 아니라
    # 화면 밖으로 비워진 글이었다. 진전(새 ID/새 요소/문서 높이) 기준으로 끝을 판단한다.
    assert_equal(stall_decision(True, 2), (0, False), "progress resets")
    assert_equal(stall_decision(False, 0), (1, False), "1st stall")
    assert_equal(stall_decision(False, 1), (2, False), "2nd stall")
    assert_equal(stall_decision(False, 2), (3, True), "3rd consecutive stall ends")


NOW_EVAL = datetime(2026, 9, 28, 17, 0)


def test_evaluate_post_pipeline_order_and_reasons() -> None:
    fresh = {"estimate": "2026-09-28T15:00", "precision": "hour"}
    old = parse_time_label("2021년 1월 19일", NOW_EVAL)  # HCM DRY-RUN에 실제로 보인 날짜
    pm = PM_JOB_TEXT
    assert_equal(evaluate_post("Ai đi cà phê không, chiều nay rảnh", fresh, True, "Bắc Ninh", now=NOW_EVAL)[0],
                 "not_job", "not a job")
    assert_equal(evaluate_post(SEEKER_POST_20260928, fresh, True, "Bắc Ninh", now=NOW_EVAL)[0],
                 "self_promo", "seeker")
    assert_equal(evaluate_post(pm, fresh, False, "Bắc Ninh", now=NOW_EVAL)[0], "truncated", "not full text")
    assert_equal(evaluate_post(pm, None, True, "Bắc Ninh", now=NOW_EVAL)[0], "time_unknown", "no time")
    d, reasons, job = evaluate_post(pm, old, True, "Bắc Ninh", now=NOW_EVAL)
    assert_equal((d, job), ("too_old", None), "2021 post must not be saved")
    assert_true("기준" in reasons[0], "reason explains threshold")
    assert_equal(evaluate_post(pm, parse_time_label("4일", NOW_EVAL), True, "Bắc Ninh", now=NOW_EVAL,
                               max_age_days=3)[0], "too_old", "4 days > 3")
    assert_equal(evaluate_post(pm, parse_time_label("3일", NOW_EVAL), True, "Bắc Ninh", now=NOW_EVAL,
                               max_age_days=3)[0], "accepted", "3 days is within 3")
    no_contact = "Cần tuyển 2 bạn phục vụ quán cafe khu Kinh Bắc, lương 7 triệu/tháng, làm ca sáng, ưu tiên nữ nhanh nhẹn"
    assert_equal(evaluate_post(no_contact, fresh, True, "Bắc Ninh", now=NOW_EVAL)[:2],
                 ("missing_required", ["연락처 없음"]), "missing contact")
    d, reasons, job = evaluate_post(pm, fresh, True, "Bắc Ninh", now=NOW_EVAL)
    assert_equal(d, "accepted", "complete fresh job accepted")
    assert_equal(job["salary"], "30 TRIỆU/THÁNG", "job parsed")
    assert_true(job["fb_full_text_confirmed"], "full text flag set")


def test_order_consistency_and_miss_risk() -> None:
    assert_equal(order_consistency([2, 9, 21, 24, 48, 72]), 1.0, "Bắc Ninh 16:11: newest-first")
    assert_true(order_consistency([10, 200, 5, 300, 1]) < 0.6, "mixed order detected")
    assert_equal(order_consistency([5]), None, "not enough data")
    assert_equal(miss_risk(True, 3, 50), "low", "overlap with previous run")
    assert_true(miss_risk(True, 0, 50).startswith("high"), "no overlap with previous run")
    assert_equal(miss_risk(False, 0, 72), "low", "read back 3 days on first run")
    assert_true(miss_risk(False, 0, 10).startswith("high"), "read only 10h on first run")


def test_dedup_title_edit_and_cross_group_repost() -> None:
    original = parse_post({"text": PM_JOB_TEXT, "location": "Bắc Ninh"})
    existing = [{"title": original["title"], "company": original["company"], "description": original["description"]}]
    # 상태 파일 소실 + 작성자가 제목(첫 줄)만 수정 → 제목+회사·전체 지문은 달라지지만 제목 뺀 본문 지문으로 차단
    edited = parse_post({"text": PM_JOB_TEXT.replace("TUYỂN DỤNG QUẢN LÝ DỰ ÁN", "TUYỂN GẤP QUẢN LÝ DỰ ÁN (HSK5)", 1),
                         "location": "Bắc Ninh"})
    assert_true(edited["title"] != original["title"], "title really changed")
    assert_equal(filter_new_jobs([edited], existing), [], "title-only edit is still a duplicate")
    # 다른 그룹에 같은 글(다른 게시물 ID) → 본문 지문으로 차단
    repost = parse_post({"text": PM_JOB_TEXT, "location": "Hà Nội"})
    assert_equal(filter_new_jobs([repost], existing), [], "cross-group repost is a duplicate")
    # 짧은 본문은 '제목 뺀 지문'을 쓰지 않아 다른 공고를 잘못 막지 않는다
    a = parse_post({"text": "Cần tuyển phục vụ\nZalo 0911111111", "location": "Bắc Ninh"})
    b = parse_post({"text": "Cần tuyển bảo vệ ca đêm\nZalo 0911111111", "location": "Bắc Ninh"})
    assert_equal(len(filter_new_jobs([b], [{"title": a["title"], "company": "x", "description": a["description"]}])), 1,
                 "short bodies are not over-deduplicated")


def test_seen_state_backup_used_when_main_file_corrupt() -> None:
    import tempfile
    from pathlib import Path
    d = Path(tempfile.mkdtemp())
    path = d / "facebook_seen.json"
    write_json_atomic(path, {"g": {"keys": ["id:1"]}}, keep_backup=True)
    write_json_atomic(path, {"g": {"keys": ["id:2", "id:1"]}}, keep_backup=True)
    assert_equal(load_seen_state(path)["g"]["keys"], ["id:2", "id:1"], "main file")
    path.write_text("{broken", encoding="utf-8")  # 쓰기 중 손상 가정
    assert_equal(load_seen_state(path)["g"]["keys"], ["id:1"], "falls back to .bak")
    path.unlink()
    path.with_suffix(".json.bak").unlink()
    assert_equal(load_seen_state(path), {}, "both gone -> empty (DB dedup still protects)")


def test_db_dedup_survives_extraction_change_and_lost_state() -> None:
    text = "Cần tuyển 2 bạn phục vụ quán cafe, lương 7 triệu/tháng, Zalo 0988000111"
    job = parse_post({"text": text, "location": "Bắc Ninh"})
    # 이전에 저장된 행: 같은 본문이지만 옛 추출 로직 때문에 제목/회사가 달랐던 경우
    existing = [{"title": "옛 제목", "company": "옛 회사", "description": "[source:facebook] " + text}]
    assert_equal(filter_new_jobs([job], existing), [], "same body must not be re-saved")
    # 같은 실행에서 두 번 모인 경우
    assert_equal(len(filter_new_jobs([job, dict(job)], [])), 1, "in-run duplicate")
    other = parse_post({"text": "Cần tuyển bảo vệ ca đêm, lương 8 triệu, Zalo 0977000222", "location": "Bắc Ninh"})
    assert_equal(len(filter_new_jobs([other], existing)), 1, "different post is kept")


# 2026-09-28 VPS DRY-RUN에서 실제 수집된 두 글
PM_JOB_TEXT = """TUYỂN DỤNG QUẢN LÝ DỰ ÁN - KCN VSIP BẮC NINH
 LƯƠNG: upto 30 TRIỆU/THÁNG
 YÊU CẦU
Nam, CĐ/ĐH, ưu tiên chuyên ngành kỹ thuật.
Tiếng Trung HSK4/5 – 4 kỹ năng, giao tiếp tốt.
≥1 năm kinh nghiệm phiên dịch kỹ thuật/sản xuất hoặc đi làm dự án, quản lý dự án.
Nhanh nhẹn, chăm chỉ, nhiệt tình, linh hoạt.
Sẵn sàng đi công tác.
 QUYỀN LỢI
 8h00–17h00 | T2–T6 + 2 T7/tháng.
Đóng đầy đủ BHXH, BHYT, BHTN theo quy định.
Thưởng lễ, Tết, du lịch hằng năm.
Môi trường năng động, sếp thoải mái.
 ỨNG TUYỂN/ZALO: 0344 849 982"""
TRUNCATED_TUTOR_TEXT = "TRUNG TÂM TIẾNG ANH ARMY ENGLISH TUYỂN DỤNG TRỢ GIẢNG GIÁO VIÊN NƯỚC NGOÀI FULL-TIME \n…"


def test_truncated_post_detection() -> None:
    assert_true(is_truncated_post(TRUNCATED_TUTOR_TEXT), "ellipsis ending = truncated")
    assert_true(is_truncated_post("Cần tuyển phục vụ quán cafe lương 7tr...", False), "three dots")
    assert_true(is_truncated_post("Cần tuyển phục vụ quán cafe\n더 보기"), "see-more label at end")
    assert_true(is_truncated_post(PM_JOB_TEXT, has_see_more=True), "button still present")
    assert_false(is_truncated_post(PM_JOB_TEXT), "full text is not truncated")


def test_required_fields_block_truncated_and_accept_full() -> None:
    tutor = parse_post({"text": TRUNCATED_TUTOR_TEXT, "location": "Bắc Ninh"})
    assert_true("본문 잘림" in missing_required(tutor), "truncated tutor post must not be saved")
    assert_true("연락처 없음" in missing_required(tutor), "no contact in truncated preview")
    pm = parse_post({"text": PM_JOB_TEXT, "location": "Bắc Ninh"})
    assert_equal(missing_required(pm), [], "full PM post passes")
    seeker = parse_post({"text": SEEKER_POST_20260928, "location": "Bắc Ninh"})
    assert_true("구직자 홍보글" in missing_required(seeker), "seeker blocked at save too")


def test_author_ellipsis_allowed_only_when_screen_confirmed() -> None:
    text = "Cần tuyển 2 bạn phục vụ quán cafe, lương 7 triệu/tháng, Zalo 0988000111. Ai cần việc thì vô đây nào …"
    job = parse_post({"text": text, "location": "Bắc Ninh"})
    assert_true("본문 잘림" in missing_required(job), "ellipsis without screen confirmation is rejected")
    job["fb_full_text_confirmed"] = True
    assert_equal(missing_required(job), [], "confirmed no see-more element -> author's own ellipsis is full text")
    job["description"] = "[source:facebook] Cần tuyển phục vụ, Zalo 0988000111\n더 보기"
    assert_true("본문 잘림" in missing_required(job), "see-more label at end is always truncated")


def test_salary_and_company_from_real_posts() -> None:
    pm = parse_post({"text": PM_JOB_TEXT, "location": "Bắc Ninh"})
    assert_equal(pm["salary"], "30 TRIỆU/THÁNG", "uppercase month suffix kept")
    assert_equal(pm["employer_phone"], "0344849982", "spaced phone")
    assert_equal(extract_company(TRUNCATED_TUTOR_TEXT), "TIẾNG ANH ARMY ENGLISH", "company stops before TUYỂN DỤNG")


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
        test_self_promotion_seeker_posts_rejected,
        test_self_promotion_keeps_real_job_ads,
        test_agency_wage_post_detected_and_non_jobs_unchanged,
        test_clean_text_strips_see_less_toggle,
        test_stall_ends_only_after_consecutive_no_progress,
        test_evaluate_post_pipeline_order_and_reasons,
        test_order_consistency_and_miss_risk,
        test_dedup_title_edit_and_cross_group_repost,
        test_seen_state_backup_used_when_main_file_corrupt,
        test_db_dedup_survives_extraction_change_and_lost_state,
        test_truncated_post_detection,
        test_required_fields_block_truncated_and_accept_full,
        test_salary_and_company_from_real_posts,
        test_author_ellipsis_allowed_only_when_screen_confirmed,
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

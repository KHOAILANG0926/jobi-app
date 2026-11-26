"""source_fields 단위 시험: 원문 근거 칸 추출·규칙 거부 집계."""
from source_fields import (RuleRejections, build_source_text, extract_age_range, extract_contact_name, extract_employment_type, extract_employment_type_extra,
                           rule_code, source_fields)


def test_age():
    assert extract_age_range("Tuyển công nhân 14-50t lương 310k") == (14, 50)
    assert extract_age_range("Tuổi 18-35 tuổi") == (18, 35)
    assert extract_age_range("tuổi: 18-35") == (18, 35)
    assert extract_age_range("Lương 8-12 triệu, 5 ngày") == (None, None)
    assert extract_age_range("50-14t") == (None, None)


def test_contact_name_verbatim_or_none():
    t = "Cần tuyển 10 công nhân. Liên hệ: Anh Hùng 0912345678"
    assert extract_contact_name(t) == "Hùng" and "Hùng" in t
    t2 = "LH: NGOC ANH DUONG - 08.778.807.56"
    assert extract_contact_name(t2) == "NGOC ANH DUONG"
    assert extract_contact_name("Liên hệ Zalo 0912345678") is None
    assert extract_contact_name("Liên hệ ngay để biết thêm") is None
    assert extract_contact_name("Không có tên người liên hệ") is None
    assert extract_contact_name("") is None and extract_contact_name(None) is None


def test_employment_type_only_from_explicit_words():
    """Lee 2026-11-25: 원문에 분명한 근거가 있을 때만 — 한 종류만 있으면 그 값, 없거나 여러 종류면 None(추정·선택 금지)."""
    # vieclam24h 사이트 칸 값(source_text에 줄로 들어감)
    assert source_fields("Nhân viên kho", "Mô tả công việc\nSắp xếp hàng", extras=("CTY A", "Toàn thời gian cố định"))["employment_type"] == "full_time"
    assert extract_employment_type("Hình thức làm việc: Bán thời gian") == "part_time"
    assert extract_employment_type("Tuyển nhân viên phục vụ part-time ca tối") == "part_time"
    assert extract_employment_type("TUYỂN CÔNG NHÂN THỜI VỤ tháng 12") == "seasonal"
    assert extract_employment_type("Tuyển nv Fulltime, lương 8tr") == "full_time"
    # 여러 종류(직무별 다름)는 고르지 않는다 — 이름표 줄이 한 종류면 그 줄을 따른다
    assert extract_employment_type("Nhân viên bán hàng Fulltime\nNhân viên bán hàng Parttime") is None
    assert extract_employment_type("Hình thức: Toàn thời gian\nSinh viên muốn làm part time vui lòng liên hệ sau") == "full_time"
    # 실제 원문(FUSHAN, src/lib/fushanSource.fixture.ts): 정규직과 시즌제 함께 모집 → 한 종류가 아님
    assert extract_employment_type("FUSHAN — Chính Thức và Thời Vụ\nTuyển: Chính Thức và Thời Vụ") is None
    # 부정·없음
    assert extract_employment_type("Không nhận part time. Làm hành chính") is None
    assert extract_employment_type("Lương 8 triệu, làm việc tại KCN") is None
    assert extract_employment_type("") is None and extract_employment_type(None) is None
    # 낱말 일부(다른 낱말 안)는 근거가 아니다
    assert extract_employment_type("Tuyển thời vụa") is None and extract_employment_type("fulltimer") is None


def test_employment_type_extra_only_from_explicit_words():
    """추가 고용형태(#622 후속, Lee 2026-11-25 고용형태 판독): 인턴·협력자 낱말이 한 종류일 때만. 계약(hợp đồng)은 읽지 않는다."""
    assert extract_employment_type_extra("Tuyển thực tập sinh kế toán") == "internship"
    assert extract_employment_type_extra("Nhận sinh viên thực tập, có hỗ trợ") == "internship"
    assert extract_employment_type_extra("Thời gian thực tập 2 tháng") is None, "인턴 사원 낱말이 아니면 근거 아님"
    assert extract_employment_type_extra("Tuyển CTV bán hàng online") == "collaborator"
    assert extract_employment_type_extra("Cần tuyển gấp cộng tác viên part-time") == "collaborator"
    # 실제 원문(TEFAL, src/lib/realJobs.fixtures.ts): 소개 보상 프로그램 — 고용형태가 아니다
    assert extract_employment_type_extra("Chương trình cộng tác viên: 500.000đ/ứng viên tham gia phỏng vấn") is None
    assert extract_employment_type_extra("Tuyển thực tập sinh. Tuyển CTV bán hàng") is None, "여러 종류는 고르지 않음"
    assert extract_employment_type_extra("Ký hợp đồng lao động sau thử việc") is None, "근로계약 문구는 근거가 아님"
    assert extract_employment_type_extra("Không nhận thực tập") is None
    assert extract_employment_type_extra("Lương 8 triệu") is None and extract_employment_type_extra(None) is None
    assert source_fields("Tuyển CTV", "Bán hàng")["employment_type_extra"] == "collaborator"


def test_source_text_is_verbatim_join():
    assert build_source_text("  Tiêu đề  ", "Dòng 1\n\nDòng 2  ", None) == "Tiêu đề\nDòng 1\n\nDòng 2"
    f = source_fields("Tuyển gấp 14-50t", "Công ty KDA\nLH: NGOC ANH DUONG")
    assert f["source_text"].startswith("Tuyển gấp 14-50t\n") and f["age_min"] == 14 and f["age_max"] == 50
    assert f["contact_name"] == "NGOC ANH DUONG" and f["contact_name"] in f["source_text"]
    assert source_fields("a", "b")["age_min"] is None and source_fields("", "")["source_text"] is None


def test_extras_inserted_verbatim_between_title_and_body():
    f = source_fields("Tiêu đề", "Nội dung", extras=("CÔNG TY KDA", None, "310.000đ"))
    assert f["source_text"] == "Tiêu đề\nCÔNG TY KDA\n310.000đ\nNội dung"


def test_rule_code_and_counter():
    assert rule_code('{"message":"job_rule_R3: source_text(원문)가 비어 있음"}') == "job_rule_R3"
    assert rule_code("job_posting_policy_excluded: exclude:x") == "job_posting_policy_excluded"
    assert rule_code("connection reset") is None
    r = RuleRejections()
    r.add("job_rule_R3", "a"); r.add("job_rule_R3", "b"); r.add("job_rule_R5", "c")
    assert r.total == 3 and "job_rule_R3=2" in r.summary() and "job_rule_R5=1" in r.summary()
    assert RuleRejections().summary() == "규칙 거부 0건"


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_source_fields: all passed")

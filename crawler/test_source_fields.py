"""source_fields 단위 시험: 원문 근거 칸 추출·규칙 거부 집계."""
from source_fields import (RuleRejections, build_source_text, extract_age_range, extract_contact_name, rule_code,
                           source_fields)


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


def test_source_text_is_verbatim_join():
    assert build_source_text("  Tiêu đề  ", "Dòng 1\n\nDòng 2  ", None) == "Tiêu đề\nDòng 1\n\nDòng 2"
    f = source_fields("Tuyển gấp 14-50t", "Công ty KDA\nLH: NGOC ANH DUONG")
    assert f["source_text"].startswith("Tuyển gấp 14-50t\n") and f["age_min"] == 14 and f["age_max"] == 50
    assert f["contact_name"] == "NGOC ANH DUONG" and f["contact_name"] in f["source_text"]
    assert source_fields("a", "b")["age_min"] is None and source_fields("", "")["source_text"] is None


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

"""다시 처리 매장 줄 합치기를 실제 공고 주소로 먼저 돌려 본다(2026-11-12 Lee "이런 거는 어떻게 고치냐")."""
from pin_guard import merge_store_rows

LY_THAI_TO = "Số 37 Đường Lý Thái Tổ, P. Võ Cường, TP. Bắc Ninh"
TRAN_PHU = "Đường Trần Phú, Phường Từ Sơn, Thành phố Bắc Ninh"


def test_mediamart_existing_row_with_region_suffix_is_same_store():
    # 운영 5994: 기존 줄은 지역이 덧붙어 저장됨 → 같은 매장을 새 줄로 넣지 않는다(2026-11-11 같은 좌표 핀 2개)
    existing = [{"raw_address": LY_THAI_TO + ", Bắc Ninh", "lat": 21.17, "lng": 106.06, "location_verified": True}]
    rows = merge_store_rows(existing, [LY_THAI_TO, TRAN_PHU])
    assert rows == [{"raw_address": LY_THAI_TO + ", Bắc Ninh"}, {"raw_address": TRAN_PHU}]


def test_existing_duplicate_rows_collapse_keeping_admin_confirmed():
    existing = [{"raw_address": LY_THAI_TO + ", Bắc Ninh", "lat": None, "lng": None},
                {"raw_address": LY_THAI_TO, "lat": 21.17, "lng": 106.06, "point_authority": "admin_confirmed"}]
    assert merge_store_rows(existing, [LY_THAI_TO]) == [{"raw_address": LY_THAI_TO}]


def test_krik_no_change_returns_empty():
    existing = [{"raw_address": "152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh"}, {"raw_address": "148 Trần Phú, Từ Sơn, Bắc Ninh"}]
    assert merge_store_rows(existing, ["152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh", "148 Trần Phú, Từ Sơn, Bắc Ninh"]) == []


def test_house_number_is_not_merged():
    assert merge_store_rows([{"raw_address": "12 Nguyễn Trãi, Bắc Ninh"}], ["112 Nguyễn Trãi, Bắc Ninh"]) == [
        {"raw_address": "12 Nguyễn Trãi, Bắc Ninh"}, {"raw_address": "112 Nguyễn Trãi, Bắc Ninh"}]


def test_refresh_keeps_location_when_source_has_no_address():
    # 운영 5942 HAIDILAO(2026-11-12 19:52 대기열 실패): 원문에 번지가 없으면 위치 칸은 고치지 않는다(관리자 확정 위치 보존)
    from refresh_facebook_existing import refresh_fields
    assert refresh_fields({"title": "t", "company": "HAIDILAO VINCOM BẮC NINH", "location": ""}) == ["title", "company"]
    assert refresh_fields({"title": "t", "company": "c", "location": "152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh"}) == ["title", "company", "location"]


def test_refresh_keeps_confirmed_location_on_notation_only_change():
    # 지도 정상화 W4b: 같은 지점인데 표기(지역 덧붙임)만 다른 주소로 위치 글자를 바꾸면 DB가 확정 좌표를 지운다 → 확정 줄이면 기존 글자 유지
    from pin_guard import keeps_confirmed_location as keep
    old = "152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh"
    confirmed = [{"raw_address": old, "lat": 21.18, "lng": 106.07, "point_authority": "admin_confirmed"}]
    verified = [{"raw_address": old, "lat": 21.18, "lng": 106.07, "location_verified": True}]
    assert keep(old, "152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh, Việt Nam", confirmed)      # 뒤에 지역만 덧붙음
    assert keep(old, "152 Trần Hưng Đạo", verified)                                          # 더 짧은 표기(번지 있음)
    assert not keep(old, old, confirmed)                                                      # 같은 글자 = 바뀌는 것 없음
    assert not keep(old, "340 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh", confirmed)                  # 다른 번지 = 다른 지점
    assert not keep(old, "Tầng 2, 152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh", confirmed)          # 앞에 글자가 붙음 = 같은 지점으로 보지 않음
    assert not keep("Trần Hưng Đạo, Bắc Ninh", "Trần Hưng Đạo", [{"raw_address": "Trần Hưng Đạo, Bắc Ninh", "lat": 1.0, "lng": 2.0, "location_verified": True}])  # 번지 없는 거리 이름
    assert not keep(old, "152 Trần Hưng Đạo", [{"raw_address": old, "lat": 21.18, "lng": 106.07}])   # 확정 아님 = 예전 동작
    assert not keep(old, "152 Trần Hưng Đạo", [{"raw_address": old, "lat": None, "lng": None, "location_verified": True}])  # 좌표 없음
    assert not keep(old, "152 Trần Hưng Đạo", [{"raw_address": "다른 줄", "lat": 1.0, "lng": 2.0, "location_verified": True}])  # 그 글자의 줄이 아님
    assert not keep(old, "152 Trần Hưng Đạo", [])


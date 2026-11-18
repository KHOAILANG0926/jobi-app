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

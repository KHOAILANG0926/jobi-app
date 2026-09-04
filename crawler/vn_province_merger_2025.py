"""베트남 2025년 성급(省級) 행정구역 통합표 — 63개 성/시를 34개로 축소
(2025-04-12 중앙당 결의 60-NQ/TW, 2025-06-12 국회 결의로 확정, 2025-07-01 시행).

특정 성(예: Bình Dương)만 예외로 다루던 방식(geocode.py의 옛
_EX_BINH_DUONG_DISTRICTS) 대신, 전체 34개 단위를 하나의 버전 있는 표로
관리한다 — 원문 주소 텍스트가 신/구 어느 명칭을 쓰든, geocoder가 신/구 어느
명칭을 반환하든 "같은 성"으로 인식하기 위한 근거 데이터다.

이 표는 오직 "같은 성(행정권역)인가"만 판단하는 데 쓰인다. 같은 성으로
인정된다고 해서 좌표가 자동으로 exact/ward 등급이 되는 것은 아니다 —
도로/산업단지/동 이름 일치와 여러 쿼리 변형 간 좌표 수렴 여부는
geocode.resolve_coordinate_accuracy()가 별도로, 여전히 그대로 검증한다.

출처: 독립된 두 공개 정리 자료(ketoananpha.vn, dauthau.asia)가 모두 동일한
34개 단위 구성으로 일치함을 교차 확인(2026-09-04 조사). 표기는 이 저장소의
기존 정식 지역명 표기(job_quality.PROVINCE_COORDS/LISTING_CITY_KEYWORDS,
src/data/jobRegions.ts와 동기화된 표기)를 따른다.
"""
from __future__ import annotations

from job_quality import ascii_key

PROVINCE_MERGER_VERSION = "2025-07-01.province-merger-v1"

# {새(현재) 성 이름: [그 성으로 통합된 옛 성 이름 전부 + 자기 자신]}.
# 통합 없이 유지된 성도 자기 자신 하나짜리 그룹으로 명시적으로 포함해, "그룹이
# 없음"과 "그룹이 자기 자신뿐임"을 호출부가 구분할 필요가 없게 한다.
PROVINCE_MERGER_GROUPS_2025: dict[str, list[str]] = {
    # ── 통합된 23개 ──────────────────────────────────────────────
    "Tuyên Quang": ["Tuyên Quang", "Hà Giang"],
    "Lào Cai": ["Lào Cai", "Yên Bái"],
    "Thái Nguyên": ["Thái Nguyên", "Bắc Kạn"],
    "Phú Thọ": ["Phú Thọ", "Vĩnh Phúc", "Hòa Bình"],
    "Bắc Ninh": ["Bắc Ninh", "Bắc Giang"],
    "Hưng Yên": ["Hưng Yên", "Thái Bình"],
    "Hải Phòng": ["Hải Phòng", "Hải Dương"],
    "Ninh Bình": ["Ninh Bình", "Hà Nam", "Nam Định"],
    "Quảng Trị": ["Quảng Trị", "Quảng Bình"],
    "Đà Nẵng": ["Đà Nẵng", "Quảng Nam"],
    "Quảng Ngãi": ["Quảng Ngãi", "Kon Tum"],
    "Gia Lai": ["Gia Lai", "Bình Định"],
    "Khánh Hòa": ["Khánh Hòa", "Ninh Thuận"],
    "Lâm Đồng": ["Lâm Đồng", "Đắk Nông", "Bình Thuận"],
    "Đắk Lắk": ["Đắk Lắk", "Phú Yên"],
    "Hồ Chí Minh": ["Hồ Chí Minh", "Bình Dương", "Bà Rịa - Vũng Tàu"],
    "Đồng Nai": ["Đồng Nai", "Bình Phước"],
    "Tây Ninh": ["Tây Ninh", "Long An"],
    "Cần Thơ": ["Cần Thơ", "Sóc Trăng", "Hậu Giang"],
    "Vĩnh Long": ["Vĩnh Long", "Bến Tre", "Trà Vinh"],
    "Đồng Tháp": ["Đồng Tháp", "Tiền Giang"],
    "Cà Mau": ["Cà Mau", "Bạc Liêu"],
    "An Giang": ["An Giang", "Kiên Giang"],
    # ── 통합 없이 유지된 11개 ────────────────────────────────────
    "Hà Nội": ["Hà Nội"],
    "Huế": ["Huế"],
    "Lai Châu": ["Lai Châu"],
    "Điện Biên": ["Điện Biên"],
    "Sơn La": ["Sơn La"],
    "Lạng Sơn": ["Lạng Sơn"],
    "Quảng Ninh": ["Quảng Ninh"],
    "Thanh Hóa": ["Thanh Hóa"],
    "Nghệ An": ["Nghệ An"],
    "Hà Tĩnh": ["Hà Tĩnh"],
    "Cao Bằng": ["Cao Bằng"],
}

# ascii-key(신/구 이름 아무거나) -> ascii-key(그 그룹의 새 대표 이름).
PROVINCE_MERGER_INDEX_2025: dict[str, str] = {
    ascii_key(member): ascii_key(canonical)
    for canonical, members in PROVINCE_MERGER_GROUPS_2025.items()
    for member in members
}

# ascii-key(새 대표 이름) -> 그 그룹에 속한 모든 이름의 ascii-key 집합.
PROVINCE_MERGER_VARIANTS_2025: dict[str, set[str]] = {
    ascii_key(canonical): {ascii_key(m) for m in members}
    for canonical, members in PROVINCE_MERGER_GROUPS_2025.items()
}

# ascii-key(새 대표 이름) -> 실제 표시용 이름(원래 표기 그대로).
_CANONICAL_DISPLAY_BY_KEY: dict[str, str] = {
    ascii_key(canonical): canonical for canonical in PROVINCE_MERGER_GROUPS_2025
}


def merged_province_group(name: str) -> set[str]:
    """name(신/구 표기 무관, 원문 그대로) -> 같은 2025 통합 그룹에 속한 모든
    이름의 ascii-key 집합(자기 자신 포함). 이 표에서 인식 못 하는 이름이면
    {ascii_key(name)} 하나만(자기 자신과만 일치) 돌려준다 — 인식 실패가
    "전부와 일치"로 잘못 넓어지지 않게 한다."""
    key = ascii_key(name)
    if not key:
        return set()
    canonical_key = PROVINCE_MERGER_INDEX_2025.get(key)
    if canonical_key is None:
        return {key}
    return PROVINCE_MERGER_VARIANTS_2025.get(canonical_key, {key})


def canonical_province_name_2025(name: str) -> str | None:
    """name -> 그 성이 속한 2025 통합 그룹의 새(현재) 이름(표시용). 이 표에서
    인식 못 하는 이름이면 None."""
    key = ascii_key(name)
    if not key:
        return None
    canonical_key = PROVINCE_MERGER_INDEX_2025.get(key)
    if canonical_key is None:
        return None
    return _CANONICAL_DISPLAY_BY_KEY.get(canonical_key)

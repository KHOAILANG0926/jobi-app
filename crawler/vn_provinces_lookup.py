"""베트남 2025-07-01 행정구역 개편 이후 공식 성/시(34개)·동/사 조회.

`vietnam-provinces` 패키지(통계총국 공식 자료, pip install vietnam-provinces) 기반 —
`vn_province_merger_2025.py`(성/시 단위만 다룸, "같은 성인가"만 판정)와 달리 이 모듈은
동/사(xã/phường) 단위까지 내려간다.

핵심 문제: Geoapify 지오코딩 결과가 옛날(2025년 이전, 군/구 있던 시절) 이름과 새
이름을 섞어서 반환한다(2026-09-16 실측 확인 — 같은 시점에 크롤링해도 "Quan 8" 같은
옛 이름과 "Phường Long An" 같은 새 이름이 같이 나옴, 군/구 자체는 이미 폐지됨). 이
모듈은 옛 이름으로 검색해도 지금 유효한 성/시·동/사로 정확히 매핑해준다
(search_from_legacy/search_from_legacy_district) — 직접 매핑표를 만들 필요 없이
패키지가 이미 통계총국 자료로 해뒀다.
"""
from __future__ import annotations

from vietnam_provinces import Province, Ward


def resolve_current_province(text: str) -> str | None:
    """텍스트(옛 성/시 이름이든 지금 성/시 이름이든)로 지금 유효한 성/시 이름을 찾는다.
    못 찾으면 None(억지로 아무거나 반환하지 않음)."""
    text = (text or "").strip()
    if not text:
        return None
    current = Province.search(text)
    if current:
        return current[0].name
    legacy = Province.search_from_legacy(name=text)
    if legacy:
        return legacy[0].province.name
    return None


# 검색어가 "Tân"/"Long"/"Hải"처럼 흔한 음절 하나만 남아있으면
# search_from_legacy_district()가 전국에서 그 글자를 포함하는 동을 수십~백 건씩
# 매칭시킨다(실측: "Tân" 하나로 100건 넘게 나옴) — 이런 결과는 필터 후보로 쓸모가
# 없는 노이즈이지, 진짜 후보가 아니다. 후보 수가 이 값을 넘으면 "특정 못 함"으로
# 보고 아예 버린다 — 있는 것처럼 잔뜩 보여주느니 차라리 안 보여주는 쪽을 택한다.
_MAX_USEFUL_CANDIDATES = 8


def resolve_current_wards(text: str, province_hint: str | None = None) -> list[str]:
    """텍스트(옛 군/구/동 이름이든 지금 동/사 이름이든)로 지금 유효한 동/사 이름
    후보를 찾는다. 옛 군/구 하나가 여러 새 동으로 쪼개진 경우 여러 후보를 반환할 수
    있다 — 호출부가 "후보 여러 개면 하나로 단정하지 않는다" 원칙을 지켜야 한다.
    후보가 너무 많으면(검색어가 너무 흔해서 전국에서 매칭된 경우) 쓸모없는 노이즈로
    보고 빈 리스트를 반환한다. 못 찾으면 빈 리스트."""
    text = (text or "").strip()
    if not text:
        return []

    province_code = None
    if province_hint:
        p = Province.search(province_hint)
        if p:
            province_code = p[0].code

    current = Ward.search(text, province=province_code)
    if current:
        return _cap(_dedupe_preserve_order(w.name for w in current))

    legacy_district = Ward.search_from_legacy_district(name=text)
    if legacy_district:
        return _cap(_dedupe_preserve_order(m.ward.name for m in legacy_district))

    legacy_ward = Ward.search_from_legacy(name=text)
    if legacy_ward:
        return _cap(_dedupe_preserve_order(m.ward.name for m in legacy_ward))

    return []


def _cap(items: list[str]) -> list[str]:
    return items if len(items) <= _MAX_USEFUL_CANDIDATES else []


def _dedupe_preserve_order(items) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


if __name__ == "__main__":
    import sys

    tests_province = [
        ("Ho Chi Minh", "Thành phố Hồ Chí Minh"),
        ("Ha Noi", "Thành phố Hà Nội"),
        ("Binh Duong", "Thành phố Hồ Chí Minh"),  # 2025년에 HCM으로 통합됨
        ("Bà Rịa - Vũng Tàu", "Thành phố Hồ Chí Minh"),  # 마찬가지
        ("", None),
        ("존재하지않는지역이름", None),
    ]
    ok = err = 0
    for query, expected in tests_province:
        got = resolve_current_province(query)
        status = "PASS" if got == expected else "FAIL"
        if status == "FAIL":
            err += 1
        else:
            ok += 1
        print(f"  [{status}] resolve_current_province({query!r}) = {got!r} (expected {expected!r})")

    print()
    tests_ward = [
        ("Tan Binh", True),   # 옛 군(quận), 여러 동으로 쪼개짐 — 결과 여러 개 나와야 함
        ("Quan 1", True),
        ("Ha Dong", True),
        ("", False),
        ("존재하지않는지역이름", False),
    ]
    for query, expect_results in tests_ward:
        got = resolve_current_wards(query)
        status = "PASS" if bool(got) == expect_results else "FAIL"
        if status == "FAIL":
            err += 1
        else:
            ok += 1
        print(f"  [{status}] resolve_current_wards({query!r}) -> {len(got)}건 {got[:3]}")

    print(f"\n결과: {ok}/{ok+err} 정확")
    if err:
        sys.exit(1)

"""2026-09-07 사용자 지시로 신설 — 좌표 없는 job_work_locations 재처리
작업의 일부로 추가한 strip_search_noise_phrases()의 회귀 테스트.

실제 표본(pending 76건 중 13건, MCP로 직접 조회해 확인)에서 raw_address가
"Toàn khu vực, Vũng Tàu"처럼 문구 하나만 있거나 "Toàn khu vực Hà Nội,
Đống Đa"처럼 문구 뒤에 실제 지명이 공백으로만 붙어 있는 두 가지 형태를
모두 실측했다 — 이 테스트는 그 두 형태와, 문구가 없는 정상 주소가
그대로 보존되는지를 확인한다."""

from __future__ import annotations

import geocode as geocode_module
from geocode import build_query_variants, peek_geocode_cache, strip_search_noise_phrases


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def test_strip_search_noise_phrases() -> None:
    # 실측 표본 그대로 — 문구 하나가 통째로 한 콤마 세그먼트인 경우.
    assert_equal(
        strip_search_noise_phrases("Toàn khu vực, Vũng Tàu"),
        "Vũng Tàu",
        "문구 세그먼트 제거 후 남은 지명만 남아야 함",
    )
    assert_equal(
        strip_search_noise_phrases("toàn khu vực, Tân Phú"),
        "Tân Phú",
        "소문자로 시작해도 대소문자 무관하게 제거돼야 함",
    )
    assert_equal(
        strip_search_noise_phrases("Toàn Khu Vực, Quận 1"),
        "Quận 1",
        "단어별 첫 글자 대문자 표기도 제거돼야 함",
    )
    # 실측 표본 그대로 — 문구 뒤에 콤마 없이 실제 지명이 공백으로만 붙은 경우.
    assert_equal(
        strip_search_noise_phrases("Toàn khu vực Hà Nội, Đống Đa"),
        "Hà Nội, Đống Đa",
        "문구 제거 후 뒤에 붙어 있던 실제 지명은 그대로 남아야 함",
    )
    assert_equal(
        strip_search_noise_phrases("Toàn khu vực Hồ Chí Minh, Quận 4"),
        "Hồ Chí Minh, Quận 4",
        "문구 제거 후 뒤에 붙어 있던 실제 지명은 그대로 남아야 함(표본 2)",
    )
    # 문구가 없는 정상 주소는 그대로 보존돼야 함.
    assert_equal(
        strip_search_noise_phrases("128 Vũ Phạm Hàm, Yên Hoà, Cầu Giấy"),
        "128 Vũ Phạm Hàm, Yên Hoà, Cầu Giấy",
        "노이즈 문구가 없는 정상 주소는 변형되지 않아야 함",
    )
    # 다른 노이즈 문구도 제거돼야 함.
    assert_equal(
        strip_search_noise_phrases("123 Đường ABC và các khu vực lân cận, Quận 1"),
        "123 Đường ABC, Quận 1",
        "'và các khu vực lân cận' 문구도 제거돼야 함",
    )
    # 빈 문자열/None 입력에 예외 없이 안전해야 함.
    assert_equal(strip_search_noise_phrases(""), "", "빈 문자열은 그대로")
    assert_equal(strip_search_noise_phrases(None), "", "None은 빈 문자열로")


def test_build_query_variants_applies_noise_stripping_first() -> None:
    """build_query_variants()가 raw_address를 그대로 쓰기 전에 먼저
    strip_search_noise_phrases()를 적용하는지 — 'raw' variant 자체에도
    문구가 남아있지 않아야 한다(이전에는 raw variant가 원문을 그대로 써서
    문구가 첫 번째 시도부터 노이즈로 들어갔음)."""
    variants = build_query_variants("Toàn khu vực, Vũng Tàu", "Vũng Tàu")
    raw_variant = next(v for v in variants if v["type"] == "raw")
    assert "khu vực" not in raw_variant["query"].lower(), (
        f"raw variant에 노이즈 문구가 남아있으면 안 됨: {raw_variant['query']!r}"
    )
    assert_equal(raw_variant["query"], "Vũng Tàu, Vũng Tàu, Vietnam", "raw variant 정리 결과")


def test_peek_geocode_cache_never_calls_the_api() -> None:
    """peek_geocode_cache()는 재지오코딩 CLI의 dry-run 전용 조회 함수 —
    _read_cache()만 몇 번 호출됐는지 세고, resolve_coordinate_accuracy()가
    실제로 API를 부르는 지점인 _geocode_query_raw()는 이 함수 안에서 단
    한 번도 호출되면 안 된다는 것을 감시자(monkeypatch)로 직접 확인한다."""
    original_raw = geocode_module._geocode_query_raw
    original_read_cache = geocode_module._read_cache
    api_calls: list[str] = []
    read_cache_calls: list[str] = []

    def _fake_raw(*args, **kwargs):
        api_calls.append("called")
        return {"status": "no_results", "lat": None, "lng": None, "top": None}

    def _fake_read_cache(query_text: str):
        read_cache_calls.append(query_text)
        # 첫 번째로 조회되는 query_text만 캐시 hit(success)로, 나머지는 miss로.
        if len(read_cache_calls) == 1:
            return {"lat": 10.1, "lng": 106.1, "source": "geoapify", "status": "success", "raw_response": {}}
        return None

    try:
        geocode_module._geocode_query_raw = _fake_raw
        geocode_module._read_cache = _fake_read_cache
        results = peek_geocode_cache("Toàn khu vực, Vũng Tàu", "Vũng Tàu")
    finally:
        geocode_module._geocode_query_raw = original_raw
        geocode_module._read_cache = original_read_cache

    assert_equal(len(api_calls), 0, "peek_geocode_cache는 캐시 미스여도 절대 _geocode_query_raw(API 호출)를 불러선 안 됨")
    assert_equal(len(results) >= 2, True, "'Toàn khu vực, Vũng Tàu'는 raw+bbox 등 2개 이상의 질의 변형을 가져야 함(회귀 확인)")
    assert_equal(results[0]["cache_hit"], True, "첫 변형은 fake 캐시가 hit으로 응답하도록 설정됨")
    assert_equal(all(r["cache_hit"] is False for r in results[1:]), True, "나머지 변형은 fake 캐시가 miss로 응답하도록 설정됨")
    for r in results:
        assert_equal(set(r.keys()), {"variant", "query", "cache_key", "cache_hit", "cached_status"}, "반환 dict 필드 확인")


def main() -> int:
    tests = [
        test_strip_search_noise_phrases,
        test_build_query_variants_applies_noise_stripping_first,
        test_peek_geocode_cache_never_calls_the_api,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} geocode tests passed")
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

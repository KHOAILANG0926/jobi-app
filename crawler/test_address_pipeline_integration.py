"""Integration-adjacent tests for the address pipeline pieces that live in
geocode.py / crawl_topcv.py (not job_quality.py, which stays dependency-free).
No live network calls and no DB writes — geocode.py's region-match helper is
tested directly with synthetic Geoapify-shaped dicts, and crawl_topcv.py's
duplicate-location logic is tested with synthetic resolved rows. Needs
SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in the environment only because
crawl_topcv.py and geocode.py both create a Supabase client at import time
(same requirement as running the real crawler) — this test never calls it.
"""

from __future__ import annotations

import geocode
from crawl_topcv import _address_core, _haversine_km, _is_duplicate_location, resolve_work_locations
from geocode import _region_text_matches


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def assert_true(value, label: str) -> None:
    if not value:
        raise AssertionError(label)


def assert_false(value, label: str) -> None:
    if value:
        raise AssertionError(label)


def test_region_text_matches() -> None:
    # No expectation given -> always considered a match (nothing to check against).
    assert_true(_region_text_matches({"state": "Bình Dương"}, None), "no expected region -> always matches")
    assert_true(_region_text_matches({"state": "Bình Dương"}, ""), "empty expected region -> always matches")

    # Real match in 'state'.
    assert_true(
        _region_text_matches({"state": "Bình Dương", "county": None, "city": None, "formatted": ""}, "Bình Dương"),
        "expected province found in 'state' field",
    )
    # Real match only in 'formatted' (state/county/city all missing/empty).
    assert_true(
        _region_text_matches({"formatted": "123 Abc, Thủ Dầu Một, Bình Dương, Việt Nam"}, "Bình Dương"),
        "expected province found only in 'formatted' still counts",
    )
    # Mismatch — this is the exact failure mode geocode.py's own comments describe
    # (a Tân Phú/TP.HCM address matching Bình Dương at high confidence).
    assert_false(
        _region_text_matches(
            {"state": "Bình Dương", "county": "Dĩ An", "city": "", "formatted": "..., Dĩ An, Bình Dương, Việt Nam"},
            "TP.HCM",
        ),
        "candidate resolves to Bình Dương when the source line said TP.HCM -> must NOT match",
    )
    # Diacritics/case must not cause a false mismatch.
    assert_true(
        _region_text_matches({"state": "binh duong"}, "Bình Dương"),
        "ascii-folded comparison must still match despite diacritics/case differences",
    )

    # Notation variants of the SAME province (not a merger) must match in
    # either direction — vieclam24h/Geoapify write Hồ Chí Minh several ways.
    assert_true(
        _region_text_matches({"state": "Thành phố Hồ Chí Minh"}, "TP.HCM"),
        "'TP.HCM' expected must match a 'Thành phố Hồ Chí Minh' state field (same province, different notation)",
    )
    assert_true(
        _region_text_matches({"state": "Hồ Chí Minh"}, "HCM"),
        "'HCM' abbreviation must match a full 'Hồ Chí Minh' state field",
    )


def test_region_alias_2025_merger_binh_duong_to_ho_chi_minh() -> None:
    # Evidenced merger case (job 4366's own text says "Bình Dương (cũ)" for
    # exactly these districts): an address whose source line says "Bình
    # Dương" but which Geoapify now resolves under "Hồ Chí Minh" (post-2025
    # merger) must still be accepted when the district is one of the
    # specific, evidenced ex-Bình Dương districts.
    assert_true(
        _region_text_matches({"state": "Hồ Chí Minh", "county": "Dĩ An"}, "Bình Dương"),
        "expected 'Bình Dương' + returned Hồ Chí Minh/Dĩ An (an evidenced ex-Bình Dương district) -> must match",
    )
    assert_true(
        _region_text_matches({"state": "Hồ Chí Minh", "city": "Thuận An"}, "Bình Dương"),
        "expected 'Bình Dương' + returned Hồ Chí Minh/Thuận An -> must match",
    )

    # The exception must NOT become a blanket Bình Dương<->Hồ Chí Minh alias —
    # that would silently reintroduce the exact bug _region_text_matches
    # exists to catch. Tân Phú is a real TP.HCM district that is NOT part of
    # the 2025 Bình Dương merger; an expected "Hồ Chí Minh"/"TP.HCM" address
    # that Geoapify wrongly resolves to Bình Dương must still be rejected.
    assert_false(
        _region_text_matches({"state": "Bình Dương", "county": "Thuận An"}, "TP.HCM"),
        "expected 'TP.HCM' + returned Bình Dương must NOT match even though the reverse direction is allowed for ex-Bình Dương districts — this is the original wrong-province bug",
    )
    # And a Bình Dương district that is NOT one of the evidenced ex-districts
    # must not be waved through either (only the specific evidenced list counts).
    assert_false(
        _region_text_matches({"state": "Hồ Chí Minh", "county": "Quận 1"}, "Bình Dương"),
        "expected 'Bình Dương' + returned Hồ Chí Minh/Quận 1 (not an ex-Bình Dương district) must NOT match",
    )


def test_region_match_avoids_cross_segment_substring_false_positive() -> None:
    # A naive "join every field into one string and substring-search" was
    # tried first and rejected: "Vĩnh Long" (a real province) followed by
    # "An Nhơn" (a real town in Bình Định) in a formatted address string
    # concatenates into "...vinh long an nhon..." — which contains "long an"
    # purely by adjacency, with nothing to do with Long An province.
    # Matching segment-by-segment (never across a comma) must reject this.
    assert_false(
        _region_text_matches(
            {"formatted": "12 Abc, Vĩnh Long, An Nhơn, Việt Nam"},
            "Long An",
        ),
        "'Long An' must NOT match a formatted address that merely juxtaposes unrelated 'Vĩnh Long' and 'An Nhơn' segments",
    )
    # The real province, written properly as its own segment, must still match.
    assert_true(
        _region_text_matches({"formatted": "12 Abc, Long An, Việt Nam"}, "Long An"),
        "'Long An' as its own real segment must still match",
    )


def test_haversine_and_duplicate_detection() -> None:
    # Same point -> 0 km.
    assert_true(_haversine_km(10.0, 106.0, 10.0, 106.0) < 0.001, "identical point -> ~0km")
    # Two points ~111km apart at the equator differ by 1 degree of latitude.
    assert_true(109 < _haversine_km(0.0, 0.0, 1.0, 0.0) < 112, "1 degree latitude ~111km")

    assert_equal(
        _address_core("số nhà 55 ngõ 124 đường tân triều, thanh trì"),
        "số nhà 55 ngõ 124 đường tân triều",
        "trailing comma segment (district label) stripped for core comparison",
    )
    assert_equal(_address_core("no comma at all"), "no comma at all", "no trailing comma -> unchanged")

    # The real case that motivated this: same office, 5 district labels.
    a = {"normalized_address": "số nhà 55 ngõ 124 đường tân triều, thanh trì", "lat": 20.9500, "lng": 105.7800}
    b = {"normalized_address": "số nhà 55 ngõ 124 đường tân triều, hà đông", "lat": 20.9501, "lng": 105.7801}
    assert_true(_is_duplicate_location(a, b), "same office address, different district label, near-identical coord -> duplicate")

    # Two DIFFERENT, genuinely distinct addresses must never merge just
    # because they happen to land on the same imprecise district centroid —
    # coordinate proximity alone is not enough without also matching text.
    c = {"normalized_address": "công ty tnhh abc, khu công nghiệp x", "lat": 20.9500, "lng": 105.7800}
    d = {"normalized_address": "trường mầm non y, quận z", "lat": 20.9500, "lng": 105.7800}
    assert_false(
        _is_duplicate_location(c, d),
        "same coordinate but unrelated address text -> must NOT be merged as duplicates",
    )

    # Same text-ish core but far apart -> not a duplicate (distance gate).
    e = {"normalized_address": "18 nguyễn huệ, quận 1", "lat": 10.77, "lng": 106.70}
    f = {"normalized_address": "18 nguyễn huệ, hà đông", "lat": 21.03, "lng": 105.80}
    assert_false(_is_duplicate_location(e, f), "same house-number text but ~1000km apart -> must NOT be merged")


def test_resolve_work_locations_no_api_key_is_not_a_transient_failure() -> None:
    # Force the 'no API key configured' path deterministically (never rely on
    # the ambient environment actually lacking the key — that would make this
    # test start silently hitting the live network the day someone adds it).
    # geocode_address() must return status='no_api_key' here, which is "we
    # confidently found nothing" (drop the candidate), NOT a transient
    # failure that would block syncing job_work_locations. Only 'api_error'
    # (network/API failure) should set had_transient_failure=True.
    original_key = geocode.GEOAPIFY_API_KEY
    geocode.GEOAPIFY_API_KEY = ""
    try:
        candidates = [{"text": "123 Đường ABC, Quận 1", "region_prefix": "TP.HCM"}]
        resolved, had_transient_failure = resolve_work_locations(candidates)
    finally:
        geocode.GEOAPIFY_API_KEY = original_key
    assert_equal(resolved, [], "no GEOAPIFY_API_KEY -> no candidates resolved")
    assert_false(had_transient_failure, "no_api_key must NOT be treated as a transient failure")


def main() -> int:
    tests = [
        test_region_text_matches,
        test_region_alias_2025_merger_binh_duong_to_ho_chi_minh,
        test_region_match_avoids_cross_segment_substring_false_positive,
        test_haversine_and_duplicate_detection,
        test_resolve_work_locations_no_api_key_is_not_a_transient_failure,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} address pipeline integration tests passed")
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

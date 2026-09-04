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

import asyncio

import crawl_topcv
import geocode
from crawl_topcv import _address_core, _haversine_km, _is_duplicate_location, resolve_work_locations
from geocode import (
    _bbox_for_province,
    _largest_cluster_within_km,
    _place_name_matches,
    _region_text_matches,
    build_query_variants,
    extract_place_name,
    normalize_address_for_query,
    resolve_coordinate_accuracy,
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
    # Mismatch — a genuinely unrelated province (not in the same 2025 merger
    # group as the expected one) must still be rejected.
    assert_false(
        _region_text_matches(
            {"state": "Hà Nội", "county": "Cầu Giấy", "city": "", "formatted": "..., Cầu Giấy, Hà Nội, Việt Nam"},
            "Cần Thơ",
        ),
        "candidate resolves to Hà Nội when the source line said Cần Thơ (unrelated provinces) -> must NOT match",
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
    # General, versioned 2025 province-merger table (vn_province_merger_2025.py)
    # — NOT a per-province special case. Every merged pair must match in BOTH
    # directions: raw text using the old name vs. the new name, and Geoapify/
    # OSM (which lags real administrative changes) returning either.

    # Bình Dương (old) <-> Hồ Chí Minh (new, merged group also includes Bà Rịa
    # - Vũng Tàu) — this direction was already covered by the old one-off
    # district-list exception; still covered here by the general table.
    assert_true(
        _region_text_matches({"state": "Hồ Chí Minh", "county": "Dĩ An"}, "Bình Dương"),
        "expected 'Bình Dương' + returned Hồ Chí Minh/Dĩ An -> must match (same 2025 merger group)",
    )
    # The reverse direction — expected the NEW name, geocoder returns the OLD
    # one — was the original bug this whole session's user report is about
    # (sb-4369: raw text said "Tây Ninh", Geoapify returned "Long An"). Must
    # now match too, and this is no longer conditional on a hand-picked
    # district list (e.g. "Quận 1" was previously rejected as "not an
    # evidenced ex-Bình Dương district" — under the general table it's simply
    # a district of the same (now-merged) province and must match).
    assert_true(
        _region_text_matches({"state": "Bình Dương", "county": "Thuận An"}, "TP.HCM"),
        "expected 'TP.HCM' + returned Bình Dương -> must match (reverse direction of the same merger)",
    )
    assert_true(
        _region_text_matches({"state": "Hồ Chí Minh", "county": "Quận 1"}, "Bình Dương"),
        "expected 'Bình Dương' + returned Hồ Chí Minh/Quận 1 -> must match (any district of the merged province, not just an evidenced list)",
    )

    # The real sb-4369 case: raw address said "Tây Ninh" (new name), Geoapify
    # returned "Long An" (old name, merged into the same new Tây Ninh).
    assert_true(
        _region_text_matches({"state": "Long An", "county": "Tân An"}, "Tây Ninh"),
        "expected 'Tây Ninh' + returned Long An -> must match (2025 merger: Long An + Tây Ninh -> new Tây Ninh)",
    )
    # And the reverse: raw text uses the old "Long An" name, geocoder returns
    # the new "Tây Ninh".
    assert_true(
        _region_text_matches({"state": "Tây Ninh"}, "Long An"),
        "expected 'Long An' + returned Tây Ninh -> must match (reverse direction)",
    )

    # A province genuinely NOT in the same merger group must still be
    # rejected — the general table must not become "anything matches
    # anything". Long An merged into Tây Ninh, not into Hà Nội.
    assert_false(
        _region_text_matches({"state": "Hà Nội"}, "Long An"),
        "expected 'Long An' + returned Hà Nội (unrelated province, not the same merger group) -> must NOT match",
    )


def test_region_match_recognizes_known_sub_city() -> None:
    # 실사례 회귀(2026-09-04, 사용자 지시 4단계 — C3 31건 중 10건 이상 개별
    # 분석 중 발견): "Thủ Đức"는 2021년부터 Hồ Chí Minh 산하 thành phố일 뿐
    # 별도 성이었던 적이 없는데도, Geoapify가 city 필드에 "Thủ Đức"만 채우고
    # state/county는 비워서 반환하는 경우가 많아(실측), 상위 지역명("TP.HCM")
    # 과 문자열이 전혀 겹치지 않는다는 이유로 최소 6건이 "다른 행정구역과
    # 충돌"로 잘못 거부됐다(실제로는 전부 정확한 TP.HCM 주소). "Dĩ An"/
    # "Thuận An"도 동일 패턴(구 Bình Dương 산하 thành phố, 2025 통합 이후
    # Hồ Chí Minh 그룹에 속함).
    assert_true(
        _region_text_matches({"city": "Thủ Đức"}, "TP.HCM"),
        "expected 'TP.HCM' + returned bare city='Thủ Đức' (no state/county at all) -> must match, Thủ Đức has been part of HCMC since 2021",
    )
    assert_true(
        _region_text_matches({"city": "Dĩ An"}, "Bình Dương"),
        "expected 'Bình Dương' + returned city='Dĩ An' -> must match (Dĩ An is a city within old Bình Dương)",
    )
    assert_true(
        _region_text_matches({"city": "Thuận An"}, "TP.HCM"),
        "expected 'TP.HCM' (new name) + returned city='Thuận An' (a city of old Bình Dương) -> must match through the 2025 merger group too",
    )
    # Must not over-generalize: a known sub-city name must still be rejected
    # when the expected province is genuinely unrelated to its real parent.
    assert_false(
        _region_text_matches({"city": "Thủ Đức"}, "Hà Nội"),
        "expected 'Hà Nội' + returned city='Thủ Đức' (belongs to HCMC, not Hà Nội) -> must NOT match",
    )


def test_normalize_address_for_query() -> None:
    # Strategy 3: strip "(cũ)"-style former-name annotations and dedupe
    # repeated comma segments — the real job 4366 text that motivated this.
    assert_equal(
        normalize_address_for_query("KCN Sóng Thần 1, Dĩ An, Bình Dương (cũ)., Dĩ An"),
        "KCN Sóng Thần 1, Dĩ An, Bình Dương",
        "strips (cũ) annotation and collapses the repeated 'Dĩ An' segment",
    )
    assert_equal(
        normalize_address_for_query("17 Phạm Hùng, Nam Từ Liêm"),
        "17 Phạm Hùng, Nam Từ Liêm",
        "an address with nothing to normalize is returned unchanged",
    )


def test_extract_place_name() -> None:
    assert_equal(extract_place_name("Lô K, Đường Số 6, KCN Liên Chiểu, Liên Chiểu"), "Lô K", "leading 'Lô X' extracted")
    assert_equal(
        extract_place_name("KCN Thăng Long 2 – Hưng Yên, Yên Mỹ"),
        "KCN Thăng Long 2 – Hưng Yên",
        "'KCN ...' extracted up to the next comma",
    )
    assert_equal(extract_place_name("17 Phạm Hùng, Nam Từ Liêm"), None, "no KCN/CCN/Tòa nhà/Lô signal -> None")


def test_build_query_variants() -> None:
    variants = build_query_variants("KCN Sóng Thần 1, Dĩ An, Bình Dương (cũ)., Dĩ An", "Bình Dương")
    types = [v["type"] for v in variants]
    assert_true("raw" in types, "raw variant always present")
    assert_true("normalized" in types, "normalized variant present when (cũ)/dedup changes the text")
    assert_true("place_name_only" in types, "place_name_only variant present when a KCN/Lô/... name is extractable")
    # 'structured' variant only makes sense when the trailing comma segment
    # differs from the province itself (otherwise it would just repeat "X, Bình Dương, Bình Dương, Vietnam").
    variants2 = build_query_variants("17 Phạm Hùng, Hà Nội", "Hà Nội")
    types2 = [v["type"] for v in variants2]
    assert_true("structured" not in types2, "structured variant skipped when the trailing segment IS the province itself")

    variants3 = build_query_variants("Lô 2.19B, Khu Công Nghiệp Trà Nóc 2, Ô Môn", "Cần Thơ")
    types3 = [v["type"] for v in variants3]
    assert_true("structured" in types3, "structured variant present when the trailing segment is a real district, not the province")


def test_place_name_matches() -> None:
    assert_equal(_place_name_matches({"formatted": "abc"}, None), None, "no place name to check -> None (not applicable)")
    assert_true(
        _place_name_matches({"name": "KCN Sóng Thần 1", "formatted": "..."}, "KCN Sóng Thần 1"),
        "exact place name found in 'name' field",
    )
    assert_false(
        _place_name_matches({"formatted": "Ga Liên Chiểu, Lien Chieu, Vietnam"}, "Lô K"),
        "place name not present anywhere in the result -> False",
    )


def test_resolve_coordinate_accuracy_tiers_with_mocked_geocoder() -> None:
    """No live network — geocode._geocode_query_raw is monkeypatched so each
    of the 4 tiers can be regression-tested deterministically. The exact
    scenarios (data shapes, not addresses) mirror the real vieclam24h cases
    validated live this round: 'exact' (Hà Nội, 17 Phạm Hùng — 3 variants,
    same building), 'ward' (Hưng Yên, KCN Thăng Long 2 — converge on a real
    district, place name unconfirmed), 'region' (Cần Thơ — only a province-
    wide centroid), 'unresolved' (Bình Dương, 230A/2 — a near-correct hit
    outvoted 1-vs-1 by a same-named-but-far-away centroid), plus 2 further
    real-case regressions found during the 2026-09-04 C1 전수검증: addr5
    (OfficeHaus — sparse-metadata false conflict) and addr6 (Bình Đường 3 —
    low-confidence street-name mismatch wrongly reaching 'exact')."""
    import geocode as geocode_module

    def _success(lat, lng, result_type, state=None, county=None, city=None, name=None, formatted="", street=None, address_line1=None):
        return {
            "status": "success", "lat": lat, "lng": lng,
            "top": {
                "result_type": result_type, "state": state, "county": county, "city": city,
                "name": name, "formatted": formatted, "street": street, "address_line1": address_line1,
            },
        }

    def make_fake_raw(responses_by_query: dict[str, dict]):
        def _fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            if query in responses_by_query:
                return responses_by_query[query]
            return {"status": "no_results", "lat": None, "lng": None, "top": None}
        return _fake

    original = geocode_module._geocode_query_raw
    try:
        # ── 'exact': 3 independent variants agree on the same building, no place name to confirm ──
        addr = "17 Phạm Hùng, Nam Từ Liêm"
        province = "Hà Nội"
        variants = build_query_variants(addr, province)
        same_point = _success(21.0165865, 105.7850047, "building", state="Ha Noi", city="Hanoi", county="Hoan Kiem", street="Phạm Hùng")
        geocode_module._geocode_query_raw = make_fake_raw({v["query"]: same_point for v in variants})
        r = resolve_coordinate_accuracy(addr, province)
        assert_equal(r["coordinate_accuracy"], "exact", "3 variants converging on the same building -> exact")
        assert_equal((r["lat"], r["lng"]), (21.0165865, 105.7850047), "exact tier carries the converged coordinate")

        # ── 'ward': 2+ variants agree on a real district, but the KCN name itself is never confirmed ──
        addr2 = "KCN Thăng Long 2 – Hưng Yên, Yên Mỹ"
        province2 = "Hưng Yên"
        variants2 = build_query_variants(addr2, province2)
        same_ward_point = _success(20.8521493, 106.0331637, "building", state="Hưng Yên Province", city="Yên Mỹ Commune")
        geocode_module._geocode_query_raw = make_fake_raw({v["query"]: same_ward_point for v in variants2})
        r2 = resolve_coordinate_accuracy(addr2, province2)
        assert_equal(r2["coordinate_accuracy"], "ward", "district confirmed by 2+ variants, but 'KCN Thăng Long 2' place name never matched -> ward, not exact")

        # ── 'region': only a province-wide centroid, nothing more specific ──
        addr3 = "Lô 2.19B, Khu Công Nghiệp Trà Nóc 2, Ô Môn"
        province3 = "Cần Thơ"
        variants3 = build_query_variants(addr3, province3)
        centroid_only = _success(10.0362046, 105.7872656, "city", city="Cần Thơ")
        geocode_module._geocode_query_raw = make_fake_raw({v["query"]: centroid_only for v in variants3})
        r3 = resolve_coordinate_accuracy(addr3, province3)
        assert_equal(r3["coordinate_accuracy"], "region", "only a province-wide centroid available -> region, not ward")
        assert_equal(r3["lat"], None, "region tier carries no lat/lng (no internal map marker)")

        # ── 'unresolved': a near-correct non-centroid hit outvoted 1-vs-1 by a same-named, far-away centroid ──
        addr4 = "230A/2 đường An Phú 13, KP1B, Phường An Phú, Thuận An"
        province4 = "Bình Dương"
        variants4 = build_query_variants(addr4, province4)
        wrong_far = _success(14.23966, 109.16417, "city", city="Thuan An")  # a different, unrelated "Thuan An"
        right_near = _success(10.95923, 106.7322584, "street", city="Thuận An")  # the real Thuận An, Bình Dương
        by_variant = {v["type"]: v["query"] for v in variants4}
        responses = {}
        if "raw" in by_variant:
            responses[by_variant["raw"]] = wrong_far
        if "structured" in by_variant:
            responses[by_variant["structured"]] = right_near
        geocode_module._geocode_query_raw = make_fake_raw(responses)
        r4 = resolve_coordinate_accuracy(addr4, province4)
        assert_equal(r4["coordinate_accuracy"], "unresolved", "1 correct-looking hit outvoted by 1 same-named-but-far-away hit -> unresolved, not region")

        # ── 실사례 회귀(2026-09-04, 실제 공고 100건 주소 품질 조사 중 발견):
        # Geoapify가 같은 실제 장소(좌표 동일)를 두고도 질의 문구에 따라
        # state/county를 통째로 비워서 반환하는 경우가 있다 — 이 경우 그
        # 변형 하나만으로 province_ok=False가 되어 곧바로 "충돌"로 전체가
        # unresolved 처리되던 결함(3/4 변형이 정확히 일치하는데도 거부됨).
        # 실제 케이스: "OfficeHaus, 32 Tân Thắng..." — raw/structured/bbox
        # 3개 변형은 동일 좌표에서 state="Ho Chi Minh"으로 일치했지만,
        # normalized 변형만 county/state가 비어 있어 전체가 잘못 거부됐다.
        addr5 = "OfficeHaus, 32 Tân Thắng, Phường Tân Sơn Nhì (Tân Phú Cũ), Thành phố Hồ Chí Minh, Tân Phú"
        province5 = "TP.HCM"
        variants5 = build_query_variants(addr5, province5)
        same_point_full_meta = _success(10.7999786, 106.6147282, "building", state="Ho Chi Minh", county="Quan 8", city="Thuận An", name="OfficeHaus")
        same_point_sparse_meta = _success(10.7999786, 106.6147282, "amenity", state=None, county=None, city="Thuận An", name="OfficeHaus")
        by_variant5 = {v["type"]: v["query"] for v in variants5}
        responses5 = {}
        for vtype, query in by_variant5.items():
            responses5[query] = same_point_sparse_meta if vtype == "normalized" else same_point_full_meta
        geocode_module._geocode_query_raw = make_fake_raw(responses5)
        r5 = resolve_coordinate_accuracy(addr5, province5)
        assert_true(
            r5["coordinate_accuracy"] != "unresolved",
            f"3/4 variants converge on the identical coordinate with province confirmed — a 4th variant with empty state/county at the SAME coordinate must not veto the whole match (got {r5['coordinate_accuracy']!r}, evidence: {r5['evidence']!r})",
        )

        # ── 실사례 회귀(2026-09-04, 사용자 지시 3단계 — C1 판정 7건 원문 전수검증
        # 중 발견): 신뢰도가 극히 낮은(confidence 0.06~0.08, 실측) 두 변형이
        # 서로 다른 질의 문구에도 불구하고 완전히 무관한 도로명("Bình Đường 3"
        # 을 "Đường Hòa Bình"로 — 글자만 비슷하고 실제로는 다른 길)으로
        # 오매칭되어 우연히 동일 좌표에 수렴 — "2개 변형 수렴"만으로 exact
        # 판정됨(실측: 진짜 위치인 Dĩ An에서 Google 지도 독립 대조로 약 15km
        # 떨어진 완전히 다른 동네 "Bình Thới"였음, sb 대상 job 미저장·dry-run
        # 전용 검증 중 발견 — 로컬 job id 없음). KCN/Tòa nhà/Lô 같은 명명된
        # 건물이 없는 일반 도로명 주소는 도로명 텍스트 확인 없이 좌표 수렴
        # 만으로 exact를 내주던 결함 — 이 시나리오에서 두 변형의 응답 모두
        # street/name/address_line1 어디에도 "Bình Đường"이 나타나지 않는다
        # (완전히 다른 길 이름). 수정 후에는 도로명 주소도 (건물명과 동일하게)
        # 이 텍스트 확인을 거쳐야 exact가 되고, 확인되지 않으면 ward로
        # 낮아져야 한다(이미 검증된 KCN Thăng Long 2 케이스와 동일한 경로).
        addr6 = "98/3D Bình Đường 3, phường Dĩ An, TP. HCM, Thủ Đức"
        province6 = "TP.HCM"
        variants6 = build_query_variants(addr6, province6)
        wrong_street_match = _success(
            10.768535, 106.636064, "building", state="Ho Chi Minh", county="Quan 8", city="Ho Chi Minh City",
            street="Đường Hòa Bình", address_line1="3, Đường Hòa Bình",
        )
        by_variant6 = {v["type"]: v["query"] for v in variants6}
        responses6 = {}
        for vtype in ("raw", "structured"):
            if vtype in by_variant6:
                responses6[by_variant6[vtype]] = wrong_street_match
        geocode_module._geocode_query_raw = make_fake_raw(responses6)
        r6 = resolve_coordinate_accuracy(addr6, province6)
        assert_true(
            r6["coordinate_accuracy"] != "exact",
            f"2 low-confidence variants converging on a coordinate whose street text ('Đường Hòa Bình') doesn't match "
            f"the queried street ('Bình Đường 3') must never reach exact — coordinate convergence alone isn't enough "
            f"for a plain street address any more than it is for a named building (got {r6['coordinate_accuracy']!r}, evidence: {r6['evidence']!r})",
        )
    finally:
        geocode_module._geocode_query_raw = original


def test_largest_cluster_within_km() -> None:
    a = {"lat": 10.0, "lng": 106.0}
    b = {"lat": 10.001, "lng": 106.001}  # ~150m from a
    c = {"lat": 11.0, "lng": 107.0}  # far away
    cluster = _largest_cluster_within_km([a, b, c], 0.3)
    assert_equal(len(cluster), 2, "the two nearby points form the largest cluster, the far one is excluded")
    assert_equal(_largest_cluster_within_km([a], 0.3), [a], "a single point is its own (size-1) cluster")


def test_bbox_for_province() -> None:
    assert_equal(_bbox_for_province("__not_a_real_province__"), None, "unknown province -> no bbox")
    bbox = _bbox_for_province("Hà Nội")
    assert_true(bbox is not None, "known province -> a bbox tuple")
    lon1, lat1, lon2, lat2 = bbox
    assert_true(lon1 < lon2 and lat1 < lat2, "bbox corners are correctly ordered (min, min, max, max)")


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
    # A candidate with real address text (address_accuracy='exact_text')
    # still gets a row even when geocoding can't run at all — address text
    # and coordinate accuracy are independent (see geocode.py's module
    # docstring) — but its coordinate_accuracy must be 'unresolved' with no
    # lat/lng, and this must NOT be treated as a transient failure (only a
    # real 'api_error' from the network/API should set that).
    original_key = geocode.GEOAPIFY_API_KEY
    geocode.GEOAPIFY_API_KEY = ""
    try:
        candidates = [{"text": "123 Đường ABC, Quận 1", "region_prefix": "TP.HCM"}]
        resolved, had_transient_failure = resolve_work_locations(candidates)
    finally:
        geocode.GEOAPIFY_API_KEY = original_key
    assert_equal(len(resolved), 1, "real address text still gets a row even with no GEOAPIFY_API_KEY")
    assert_equal(resolved[0]["address_accuracy"], "exact_text", "address text accuracy is independent of geocoding")
    assert_equal(resolved[0]["coordinate_accuracy"], "unresolved", "no API key -> can't resolve any coordinate")
    assert_equal(resolved[0]["lat"], None, "unresolved coordinate_accuracy carries no lat")
    assert_equal(resolved[0]["lng"], None, "unresolved coordinate_accuracy carries no lng")
    assert_false(had_transient_failure, "no_api_key must NOT be treated as a transient failure")


def test_write_guard_blocks_unconfirmed_writes() -> None:
    # 회귀 테스트 — 2026-09-04, --dry-run-urls를 검증하다가 --process-url을
    # 실수로 호출해 운영 DB에 공고 1건이 실제로 저장된 사고(id=4370, 사용자
    # 승인 후 롤백 완료)의 재발 방지. 저장 함수(upsert_job_record/
    # _replace_job_work_locations)는 enable_writes() 컨텍스트 밖에서 호출되면
    # 반드시 예외로 실패해야 한다 — 조용히 저장되면 안 된다.
    assert_false(crawl_topcv._WRITE_ENABLED, "쓰기 플래그는 기본적으로 꺼져 있어야 한다")

    failed_job = {"_pipeline_failed": True, "_failure_stage": "x", "_failure_reason": "x"}
    try:
        crawl_topcv.upsert_job_record(failed_job, {}, {})
        raise AssertionError("upsert_job_record가 enable_writes() 밖에서 예외 없이 실행됨")
    except crawl_topcv.WriteNotEnabledError:
        pass

    try:
        crawl_topcv._replace_job_work_locations(1, [])
        raise AssertionError("_replace_job_work_locations가 enable_writes() 밖에서 예외 없이 실행됨")
    except crawl_topcv.WriteNotEnabledError:
        pass

    # enable_writes() 안에서는 정상 동작 — _pipeline_failed 조기 반환 경로만
    # 확인한다(이 경로는 실제 supabase 호출을 하지 않으므로 네트워크 없이
    # 안전하게 테스트 가능).
    with crawl_topcv.enable_writes():
        result = crawl_topcv.upsert_job_record(failed_job, {}, {})
        assert_equal(result["action"], "failed_new_skipped", "enable_writes() 안에서는 정상 동작해야 한다")

    assert_false(crawl_topcv._WRITE_ENABLED, "enable_writes() 블록을 벗어나면 다시 비활성화돼야 한다")

    # --process-url/--reprocess-ids도 confirm_write 없이는 브라우저조차 열지
    # 않고(네트워크 요청 전에) 즉시 실패해야 한다.
    async def _assert_raises_without_confirm() -> None:
        try:
            await crawl_topcv.process_single_url("https://example.com/x")
            raise AssertionError("process_single_url이 confirm_write 없이 예외 없이 실행됨")
        except crawl_topcv.WriteNotEnabledError:
            pass
        try:
            await crawl_topcv.reprocess_jobs([1])
            raise AssertionError("reprocess_jobs가 confirm_write 없이 예외 없이 실행됨")
        except crawl_topcv.WriteNotEnabledError:
            pass

    asyncio.run(_assert_raises_without_confirm())


def main() -> int:
    tests = [
        test_region_text_matches,
        test_region_alias_2025_merger_binh_duong_to_ho_chi_minh,
        test_region_match_recognizes_known_sub_city,
        test_region_match_avoids_cross_segment_substring_false_positive,
        test_normalize_address_for_query,
        test_extract_place_name,
        test_build_query_variants,
        test_place_name_matches,
        test_resolve_coordinate_accuracy_tiers_with_mocked_geocoder,
        test_largest_cluster_within_km,
        test_bbox_for_province,
        test_haversine_and_duplicate_detection,
        test_resolve_work_locations_no_api_key_is_not_a_transient_failure,
        test_write_guard_blocks_unconfirmed_writes,
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

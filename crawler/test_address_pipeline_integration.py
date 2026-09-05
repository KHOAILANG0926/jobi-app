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
import inspect
import os
from contextlib import asynccontextmanager

import crawl_topcv
import geocode
from crawl_topcv import (
    VerifyWriteExistingMatchError,
    _address_core,
    _compute_job_recruitment_regions,
    _group_candidates_by_core_location,
    _haversine_km,
    _is_duplicate_location,
    _select_group_representative,
    _specificity_score,
    _strip_recruitment_region_suffix,
    resolve_work_locations,
)
from geocode import (
    _bbox_for_province,
    _largest_cluster_within_km,
    _place_name_matches,
    _region_text_matches,
    build_query_variants,
    extract_place_name,
    normalize_address_for_query,
    resolve_coordinate_accuracy,
    source_coordinate_matches_location,
)
from job_quality import (
    ascii_key,
    canonical_job_key,
    classify_work_location_candidate,
    compute_all_locations_c1_verified,
    gate_auto_publish,
    has_application_path,
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


def test_source_coordinate_matches_location() -> None:
    """실사례로 검증(2026-09-04, 사용자 지시 — vieclam24h 상세페이지 30건
    읽기 전용 구조 조사로 확인된 2건의 실제 employer_info 좌표):
    - DOJI: contact_address와 이 공고의 근무지 텍스트가 실제로 같은 건물을
      가리킴(Google 지도 독립 대조 완료, 오차 ~27m) -> True여야 함.
    - "Pha Ánh Ráng Chiều" 식당: 공고 하나에 근무지 2곳 — contact_address는
      그중 "Hàn Thuyên" 쪽과만 일치하고 "Hai Bà Trưng" 쪽과는 다른 곳(각각
      Google 지도로 독립 검증 완료, ~17m/~47m) -> 하나는 True, 하나는 False."""
    doji_contact = "Tầng 7 - Tòa nhà DOJI Tower - Số 5 Lê Duẩn - Ba Đình - Hà Nội"
    doji_location = "DOJI Tower, Số 5 Lê Duẩn, Ba Đình, Hà Nội, Ba Đình"
    assert_true(
        source_coordinate_matches_location(doji_contact, doji_location),
        "DOJI's employer contact_address must match this job's own DOJI Tower work-location text",
    )

    restaurant_contact = "23 Hàn Thuyên, P. Bến Nghé, Q1"
    han_thuyen_location = "23 Hàn Thuyên, Quận 1"
    hai_ba_trung_location = "74/7C Hai Bà Trưng, Quận 1"
    assert_true(
        source_coordinate_matches_location(restaurant_contact, han_thuyen_location),
        "employer contact_address ('23 Hàn Thuyên...') must match the work location that's the same street+number",
    )
    assert_false(
        source_coordinate_matches_location(restaurant_contact, hai_ba_trung_location),
        "employer contact_address ('23 Hàn Thuyên...') must NOT be applied to a genuinely different work location ('Hai Bà Trưng') just because they're the same job posting",
    )

    # Edge cases.
    assert_false(source_coordinate_matches_location("", doji_location), "empty contact_address -> never matches")
    assert_false(source_coordinate_matches_location(doji_contact, ""), "empty location_address -> never matches")
    assert_false(source_coordinate_matches_location(None, doji_location), "None contact_address -> never raises, never matches")
    assert_false(
        source_coordinate_matches_location("Hồ Chí Minh", "123 Nguyễn Huệ, Quận 1, TP.HCM"),
        "genuinely unrelated contact_address (no shared core identifier text) must not match",
    )
    assert_false(
        source_coordinate_matches_location("Số 1, Quận 1, TP.HCM", "1, Quận 1"),
        "a too-short core identifier (below the minimum length guard) must never trivially match, even if it's technically a substring",
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
        assert_equal(r["coordinate_accuracy"], "exact_candidate", "3 variants converging on the same building -> exact")
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
            r6["coordinate_accuracy"] != "exact_candidate",
            f"2 low-confidence variants converging on a coordinate whose street text ('Đường Hòa Bình') doesn't match "
            f"the queried street ('Bình Đường 3') must never reach exact — coordinate convergence alone isn't enough "
            f"for a plain street address any more than it is for a named building (got {r6['coordinate_accuracy']!r}, evidence: {r6['evidence']!r})",
        )

        # ── 실사례 회귀(2026-09-04, 사용자 지시 6단계 — 새 20건 첫 검증 중 발견):
        # "Parc Mall, 547-549 Tạ Quang Bửu, Phường Chánh Hưng. TP HCM, Quận 8"
        # — raw/bbox 2개 변형은 city="Thủ Đức"로 동일 좌표(진짜 위치, TP.HCM
        # 소속)에 수렴했는데, structured 변형 1개가 신뢰도 0에 가까운 완전
        # 무관한 Lâm Đồng 지역 결과를 반환했다는 이유만으로 전체가 즉시
        # unresolved 처리됐다(2:1로 명백히 열세인 단독 반대표가 무조건 거부권을
        # 행사하던 결함 — 아래 "outvoted" 검사가 이미 이런 표수 비교를 하고
        # 있었지만, 그 앞의 무조건 검사가 먼저 실행돼 판단 기회 자체가 없었음).
        addr7 = "Parc Mall, 547-549 Tạ Quang Bửu, Phường Chánh Hưng. TP HCM, Quận 8"
        province7 = "TP.HCM"
        variants7 = build_query_variants(addr7, province7)
        real_place = _success(10.7407426, 106.6791547, "amenity", city="Thủ Đức", name="Parc Mall")
        garbage_far = _success(11.9460186, 108.5012536, "building", state="Lâm Đồng Province", county="Lộc Quý")
        by_variant7 = {v["type"]: v["query"] for v in variants7}
        responses7 = {}
        for vtype, query in by_variant7.items():
            responses7[query] = garbage_far if vtype == "structured" else real_place
        geocode_module._geocode_query_raw = make_fake_raw(responses7)
        r7 = resolve_coordinate_accuracy(addr7, province7)
        assert_true(
            r7["coordinate_accuracy"] != "unresolved",
            f"2 variants (raw+bbox) converge on the correct Thủ Đức/TP.HCM location — a 3rd, lone, unrelated "
            f"Lâm Đồng result from a single variant must not veto them (got {r7['coordinate_accuracy']!r}, evidence: {r7['evidence']!r})",
        )
    finally:
        geocode_module._geocode_query_raw = original


def test_resolve_coordinate_accuracy_is_deterministic_given_fixed_fixture() -> None:
    """실사례 회귀(2026-09-05, GPT 독립검증 지적): id 4379(당시 4377) 저장
    직전 --dry-run-urls에서는 'exact_candidate'(4개 변형 수렴)였는데, 몇 분
    뒤 --verify-write-urls 실제 저장 시점에는 같은 주소가 'unresolved'
    (geocode_status='failed')로 바뀌어 저장됐다. 라이브 Geoapify를 반복
    호출해 우연히 같은 결과가 나오는지 보는 방식으로는 원인을 알 수
    없으므로, resolve_coordinate_accuracy() 자체를 고정 fixture로 여러 번
    호출해 순수 함수로서 결정적인지를 직접 증명한다.

    결론(코드 추적으로 확인, 아래 근거): resolve_coordinate_accuracy()의
    집계 로직 자체(클러스터링/충돌 판정/최다득표 선정)는 전부 len()/포함
    비교만 쓰고 정렬되지 않은 set의 반복 순서에 의존하지 않으므로 이미
    결정적이다 — 이 테스트가 그것을 직접 증명한다. 실제 불일치의 원인은
    이 함수가 아니라 그 아래 계층인 geocode._geocode_query_raw()에 있다:
    'api_error'(네트워크 오류/타임아웃) 응답은 의도적으로 캐시되지 않는다
    (geocode_address()의 docstring 참고 — 일시 오류를 "확정적으로 나쁜
    주소"로 오인하지 않기 위한 설계) — 따라서 dry-run 때 수렴했던 질의
    변형 중 하나가 실제 저장 시점에 타임아웃/일시 오류를 겪으면, 이번에는
    그 변형이 'valid' 결과 집합에서 아예 빠져 클러스터 수렴 조건(2개 이상)
    을 못 채워 등급이 낮아질 수 있다 — 함수 자체의 비결정성이 아니라
    "매 실행마다 다시 호출되는 라이브 API 응답 집합"이라는 입력 자체가
    실행마다 달라질 수 있다는 것. 아래 test_resolve_coordinate_accuracy_
    distinguishes_transient_api_error_from_confirmed_no_results가 이
    api_error 상태를 별도로 분리해 검증한다."""
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
        # id 4379(당시 4377) 실제 주소 — dry-run 시점 실측: "4 variants
        # converged <=300m, province+place confirmed" -> exact_candidate.
        addr = "19 Đặng Hữu Phổ, phường Thảo Điền, thành phố Thủ Đức (Quận 2 cũ), Thủ Đức"
        province = "TP.HCM"
        variants = build_query_variants(addr, province)
        assert_true(len(variants) >= 2, "fixture must exercise the multi-variant convergence path, not a single query")
        converged_point = _success(
            10.8033156, 106.7357165, "building",
            state="Ho Chi Minh", county="Thu Duc", city="Thủ Đức",
            street="Đặng Hữu Phổ", address_line1="19 Đặng Hữu Phổ",
        )
        fixture = {v["query"]: converged_point for v in variants}

        results = []
        for _ in range(5):
            geocode_module._geocode_query_raw = make_fake_raw(fixture)
            results.append(resolve_coordinate_accuracy(addr, province))

        first = results[0]
        for i, r in enumerate(results[1:], start=2):
            assert_equal(
                r, first,
                f"call #{i} must return byte-identical output to call #1 given the identical fixture "
                f"(got {r!r} vs {first!r}) — resolve_coordinate_accuracy() must be a pure function of its inputs",
            )
        assert_equal(first["coordinate_accuracy"], "exact_candidate", "sanity: the fixture itself should converge to exact_candidate, matching the real dry-run observation")
    finally:
        geocode_module._geocode_query_raw = original


def test_resolve_coordinate_accuracy_distinguishes_transient_api_error_from_confirmed_no_results() -> None:
    """API 응답 차이 3가지(정상 수렴 성공 / 확정적으로 결과 없음(no_results) /
    일시적 네트워크 오류(api_error))가 서로 다른 상태로 판정되는지 분리
    검증. 'unresolved' 등급 자체는 no_results와 api_error 양쪽에서 나올 수
    있지만, had_transient_failure 플래그는 실제 api_error가 있었을 때만
    True여야 한다 — 이 플래그가 upsert_job_record()에서 "이미 공개 중인
    기존 공고를 이번 실행 한정의 일시 오류로 강등하지 않는다" 보호의
    유일한 신호이므로, 확정적 no_results와 뒤섞이면 그 보호가 무의미해진다
    (반대로 no_results인데 transient로 잘못 표시되면 진짜 나쁜 주소도
    "재시도하면 언젠가 좋아질 것"처럼 취급돼 영구히 재검증을 피하게 된다)."""
    import geocode as geocode_module

    def make_fake_raw(status: str):
        def _fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            return {"status": status, "lat": None, "lng": None, "top": None}
        return _fake

    original = geocode_module._geocode_query_raw
    try:
        addr = "19 Đặng Hữu Phổ, phường Thảo Điền, thành phố Thủ Đức (Quận 2 cũ), Thủ Đức"
        province = "TP.HCM"

        # 전 변형이 확정적으로 '결과 없음' — 나쁜 주소로 판단할 근거가 있는
        # 상태. had_transient_failure는 False여야 한다(재시도로 나아질
        # 일시 오류가 아니라, 이 텍스트로는 애초에 아무 결과도 없었다는 뜻).
        geocode_module._geocode_query_raw = make_fake_raw("no_results")
        r_no_results = resolve_coordinate_accuracy(addr, province)
        assert_equal(r_no_results["coordinate_accuracy"], "unresolved", "no usable result anywhere -> unresolved")
        assert_false(r_no_results["had_transient_failure"], "confirmed no_results must NOT be flagged as a transient failure — it isn't a network problem, it's a confirmed non-match")

        # 전 변형이 네트워크/API 레벨 오류(타임아웃 등) — 이건 주소가
        # 나쁘다는 근거가 전혀 아니다. had_transient_failure는 True여야
        # 하고, 이 신호 덕분에 upsert_job_record()가 이미 공개 중인 기존
        # 공고를 이번 실행 한정으로 강등하지 않는다(crawl_topcv.py:1202,
        # test_transient_geocode_failure_never_republishes_or_corrupts_existing_verified_job
        # 참고).
        geocode_module._geocode_query_raw = make_fake_raw("api_error")
        r_api_error = resolve_coordinate_accuracy(addr, province)
        assert_equal(r_api_error["coordinate_accuracy"], "unresolved", "no successful result at all (all queries errored) -> unresolved, same tier as no_results")
        assert_true(r_api_error["had_transient_failure"], "a real api_error must be flagged transient — must never be conflated with a confirmed no_results")

        # 혼합 사례(실제 4377/4379 재현과 가장 가까움): 일부 변형은 수렴에
        # 성공하고, 나머지 한 변형만 일시 오류. 등급 자체는 성공한 변형들의
        # 수렴 결과를 따르되(이 케이스는 실제로 성공하는 변형이 1개뿐이라
        # exact/ward 조건인 "2개 이상 수렴"을 못 채워 region 이하로 떨어짐
        # — 바로 이 매커니즘이 dry-run과 실제 저장 사이에 등급이 달라진
        # 이유), 최소한 had_transient_failure=True로 "이번 판정은 일부
        # 정보 없이 내려졌다"는 사실이 유실되지 않아야 한다.
        #
        # 'structured' 변형의 질의 문구를 고른다 — 이 주소에서는 'raw'와
        # 'bbox' 변형이 완전히 동일한 질의 문자열을 쓴다(build_query_
        # variants()가 bbox_rect만 다르게 넘기고 텍스트 자체는 재사용하기
        # 때문 — 실제로 그렇다는 것을 위에서 build_query_variants() 실행
        # 결과로 확인함). 'raw'의 질의문을 골랐다면 fake가 'bbox'까지 함께
        # "성공"으로 매칭시켜버려 의도와 달리 2개 변형이 수렴한 것처럼
        # 되어버린다 — 정말로 "성공 1개"만 만들려면 다른 변형과 텍스트가
        # 겹치지 않는 'structured'를 써야 한다.
        variants = build_query_variants(addr, province)
        by_type = {v["type"]: v["query"] for v in variants}
        assert_true(len(variants) >= 2, "fixture needs 2+ variants to exercise the mixed success/error path")
        assert_true("structured" in by_type, "fixture address must produce a 'structured' variant for this test to isolate a single successful query")
        only_successful_query = by_type["structured"]
        query_texts = [v["query"] for v in variants]
        assert_equal(query_texts.count(only_successful_query), 1, "the chosen query text must be unique among this address's variants, or more than 1 slot would succeed")

        def _mixed(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            if query == only_successful_query:
                return {
                    "status": "success", "lat": 10.8033156, "lng": 106.7357165,
                    "top": {"result_type": "building", "state": "Ho Chi Minh", "county": "Thu Duc", "city": "Thủ Đức"},
                }
            return {"status": "api_error", "lat": None, "lng": None, "top": None}

        geocode_module._geocode_query_raw = _mixed
        r_mixed = resolve_coordinate_accuracy(addr, province)
        assert_true(r_mixed["had_transient_failure"], "at least one variant errored transiently — this must be visible on the result even though a usable single-variant result still came back")
        assert_true(
            r_mixed["coordinate_accuracy"] in ("region", "unresolved"),
            f"only 1 of several variants actually succeeded — that alone cannot satisfy the 2+-variant convergence required for 'exact_candidate'/'ward' (got {r_mixed['coordinate_accuracy']!r})",
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


def test_resolve_work_locations_preserves_region_only_candidates_as_rows() -> None:
    """2026-09-05 사용자 지시(최종 제품 정책, 주소 보존 규칙 #2/#8): "Địa
    điểm làm việc에 성·시·구·군만 있어도 원문 행을 버리지 마세요." 이전
    라운드까지는 classify_work_location_candidate()가 'region_only'로
    판정한 candidate는 resolve_work_locations()가 아예 건너뛰어(continue)
    job_work_locations 행 자체가 생기지 않았다 — 원문 텍스트가 통째로
    사라졌다는 뜻. 이제는 'region_only'도 행으로 남되, 구체적 장소가 없어
    Geoapify 좌표 조회는 시도하지 않는다(address_accuracy='region_only',
    coordinate_accuracy='unresolved', lat/lng=None, geocode_status=
    'pending' — 전부 기존 CHECK 제약과 호환되는 값, migration 불필요).
    'undetermined'(진짜 장소 언급이 아닌 텍스트)만 여전히 버려진다."""
    geocode_calls: list[str] = []
    original = geocode._geocode_query_raw

    def _tracking_fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
        geocode_calls.append(query)
        return {"status": "no_results", "lat": None, "lng": None, "top": None}

    try:
        geocode._geocode_query_raw = _tracking_fake

        # 성·시만 있음 — 구체적 장소 신호 전혀 없음.
        province_only = [{"text": "Hồ Chí Minh", "region_prefix": "Hồ Chí Minh"}]
        resolved_province, had_transient = resolve_work_locations(province_only)
        assert_equal(len(resolved_province), 1, "province-only candidate must still get a row, not be dropped")
        assert_equal(resolved_province[0]["raw_address"], "Hồ Chí Minh", "raw text must be preserved verbatim, not deleted")
        assert_equal(resolved_province[0]["address_accuracy"], "region_only", "province-only text classifies region_only")
        assert_equal(resolved_province[0]["coordinate_accuracy"], "unresolved", "no specific place to geocode -> unresolved, not a fabricated tier")
        assert_equal(resolved_province[0]["lat"], None, "region_only row must carry no lat")
        assert_equal(resolved_province[0]["lng"], None, "region_only row must carry no lng")
        assert_equal(resolved_province[0]["geocode_status"], "pending", "no geocode attempt was made -> 'pending', not 'failed' (CHECK-compatible: pending/success/failed/manual)")
        assert_false(resolved_province[0]["source_verified"], "region_only can never be source_verified")
        assert_false(had_transient, "skipping geocoding for region_only is not a transient failure")

        # 구·군·동만 있음 — 마찬가지로 행 보존.
        district_only = [{"text": "Huyện Củ Chi, TP Hồ Chí Minh", "region_prefix": "TP.HCM"}]
        resolved_district, _ = resolve_work_locations(district_only)
        assert_equal(len(resolved_district), 1, "district-only candidate must still get a row, not be dropped")
        assert_equal(resolved_district[0]["raw_address"], "Huyện Củ Chi, TP Hồ Chí Minh", "raw text preserved verbatim")
        assert_equal(resolved_district[0]["address_accuracy"], "region_only", "district-only text classifies region_only")

        # 'undetermined'는 여전히 버려진다(진짜 장소 언급이 아님).
        undetermined_only = [{"text": "abc", "region_prefix": "TP.HCM"}]
        resolved_undetermined, _ = resolve_work_locations(undetermined_only)
        assert_equal(len(resolved_undetermined), 0, "undetermined (not a real place mention at all) must still be dropped, unlike region_only")

        # region_only 후보는 구체적 장소가 없으므로 Geoapify에 실제로 질의를
        # 보내지 않아야 한다(불필요한 API 호출/비용 방지, 그리고 잘못된
        # 확신을 주는 결과를 만들 여지 자체를 없앰).
        assert_equal(geocode_calls, [], "region_only/undetermined candidates must never trigger a Geoapify query")
    finally:
        geocode._geocode_query_raw = original


def test_gate_publishes_partially_verified_mixed_tiers() -> None:
    """고정 테스트 #4 (2026-09-05 최종 정책): "복수 근무지 중 일부만 좌표
    검증 + 지원 경로 있음 → 공개". 이 테스트는 예전에 정반대를 검증했다
    (C1_partial은 반드시 보류) — 2026-09-04 정책이 2026-09-05 사용자 지시로
    뒤집혔으므로 같은 실사례 fixture(하나는 exact_candidate, 하나는 ward,
    둘 다 source_verified=False)를 그대로 재사용해 이번엔 반대로 공개돼야
    함을 검증한다. resolve_work_locations()가 여전히 위치별 coordinate_
    accuracy/source_verified를 정확히 계산하는지는 그대로 확인하되(지도
    표시·거리검색 자격 판단에 계속 쓰이는 값이므로), 그 결과가 더 이상
    gate_auto_publish()에 들어가지 않음을 함께 보인다."""
    original = geocode._geocode_query_raw

    def _success(lat, lng, result_type, state=None, county=None, city=None, name=None, street=None):
        return {
            "status": "success", "lat": lat, "lng": lng,
            "top": {"result_type": result_type, "state": state, "county": county, "city": city, "name": name, "street": street},
        }

    def make_fake_raw(responses_by_query: dict[str, dict]):
        def _fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            if query in responses_by_query:
                return responses_by_query[query]
            return {"status": "no_results", "lat": None, "lng": None, "top": None}
        return _fake

    try:
        exact_addr = "17 Phạm Hùng, Nam Từ Liêm"
        exact_variants = build_query_variants(exact_addr, "Hà Nội")
        exact_point = _success(21.0165865, 105.7850047, "building", state="Ha Noi", city="Hanoi", county="Hoan Kiem", street="Phạm Hùng")
        ward_addr = "KCN Thăng Long 2 – Hưng Yên, Yên Mỹ"
        ward_variants = build_query_variants(ward_addr, "Hưng Yên")
        ward_point = _success(20.8521493, 106.0331637, "building", state="Hưng Yên Province", city="Yên Mỹ Commune")

        responses: dict[str, dict] = {}
        for v in exact_variants:
            responses[v["query"]] = exact_point
        for v in ward_variants:
            responses[v["query"]] = ward_point
        geocode._geocode_query_raw = make_fake_raw(responses)

        candidates = [
            {"text": exact_addr, "region_prefix": "Hà Nội"},
            {"text": ward_addr, "region_prefix": "Hưng Yên"},
        ]
        resolved, had_transient_failure = resolve_work_locations(candidates)
        assert_equal(len(resolved), 2, "both real-address candidates get a row")
        tiers = sorted(r["coordinate_accuracy"] for r in resolved)
        assert_equal(tiers, ["exact_candidate", "ward"], "mixed-tier fixture actually produced one exact_candidate + one ward (C1_partial), not both exact_candidate")

        # 지도/거리검색 자격 판단용 계산 자체는 변경 없음 — 여전히 partial이다.
        verified = compute_all_locations_c1_verified(resolved)
        assert_false(verified, "one exact_candidate + one ward, neither source-verified -> still NOT all_locations_c1_verified (unrelated to the publish gate now)")

        job_recruitment_regions = _compute_job_recruitment_regions(candidates)
        should_publish, gate_reason = gate_auto_publish(
            has_location_or_region=len(resolved) > 0 or len(job_recruitment_regions) > 0,
            has_application_path_=has_application_path("0901234567", "", ""),
        )
        assert_true(should_publish, "final policy: coordinate verification tier no longer gates — a job with real work-location text and a valid application path must publish even when only partially/never coordinate-verified")
        assert_equal(gate_reason, "ok", "publish reason must be ok — 'no_verified_coordinate' is no longer returned by gate_auto_publish()")
    finally:
        geocode._geocode_query_raw = original


def test_gate_publishes_regardless_of_coordinate_verification_tier() -> None:
    """고정 테스트 #3 (2026-09-05 최종 정책): "구체적 주소 + 좌표 미검증 +
    지원 경로 있음 → 공개". 예전에는 이 실사례(DOJI Tower)로 정반대(원문
    좌표 검증 없이는 절대 공개 금지)를 증명했다 — 이제는 같은 fixture로
    좌표 검증 여부(exact_candidate만/틀린 employer_coordinate/올바른
    employer_coordinate 3가지 전부)와 무관하게 항상 공개됨을 증명한다.
    resolve_work_locations()/compute_all_locations_c1_verified()/
    source_coordinate_matches_location()의 좌표 검증 계산 자체는 전혀
    바뀌지 않았다(지도·거리검색 자격에는 여전히 쓰임) — 오직
    gate_auto_publish()만 이 값을 더 이상 참조하지 않는다."""
    original = geocode._geocode_query_raw

    def _success(lat, lng, result_type, state=None, county=None, city=None, name=None, street=None):
        return {
            "status": "success", "lat": lat, "lng": lng,
            "top": {"result_type": result_type, "state": state, "county": county, "city": city, "name": name, "street": street},
        }

    def make_fake_raw(responses_by_query: dict[str, dict]):
        def _fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            if query in responses_by_query:
                return responses_by_query[query]
            return {"status": "no_results", "lat": None, "lng": None, "top": None}
        return _fake

    try:
        addr = "DOJI Tower, Số 5 Lê Duẩn, Ba Đình, Hà Nội, Ba Đình"
        variants = build_query_variants(addr, "Hà Nội")
        point = _success(21.029063, 105.841809, "building", state="Ha Noi", city="Hanoi", county="Ba Dinh", name="Doji Tower", street="Đường Lê Duẩn")
        geocode._geocode_query_raw = make_fake_raw({v["query"]: point for v in variants})

        candidates = [{"text": addr, "region_prefix": "Hà Nội"}]
        job_recruitment_regions = _compute_job_recruitment_regions(candidates)

        # ── 1) employer_coordinate 없음 -> exact_candidate뿐, source_verified=False ──
        resolved_no_source, _ = resolve_work_locations(candidates, employer_coordinate=None)
        assert_equal(len(resolved_no_source), 1, "single real address gets a row")
        assert_equal(resolved_no_source[0]["coordinate_accuracy"], "exact_candidate", "Geoapify converges -> exact_candidate tier")
        assert_false(resolved_no_source[0]["source_verified"], "no employer_coordinate given -> source_verified must be False")
        assert_false(compute_all_locations_c1_verified(resolved_no_source), "exact_candidate alone (no source verification) still does not count as C1 (unrelated to the publish gate now)")
        should_publish_no_source, reason_no_source = gate_auto_publish(
            has_location_or_region=len(resolved_no_source) > 0 or len(job_recruitment_regions) > 0,
            has_application_path_=True,
        )
        assert_true(should_publish_no_source, "final policy: a real work-address + valid application path publishes even with a Geoapify-only, never source-verified coordinate")
        assert_equal(reason_no_source, "ok", "publish reason must be ok")

        # ── 2) employer_coordinate 있지만 다른 곳(contact_address 불일치) — 여전히 미검증이지만 여전히 공개 ──
        wrong_employer_coordinate = {
            "lat": 10.7758, "lng": 106.7008,  # unrelated Hồ Chí Minh coordinate
            "contact_address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
        }
        resolved_wrong, _ = resolve_work_locations(candidates, employer_coordinate=wrong_employer_coordinate)
        assert_false(resolved_wrong[0]["source_verified"], "employer_coordinate present but contact_address doesn't match this location -> must NOT be source_verified")
        assert_equal(resolved_wrong[0]["lat"], 21.029063, "unmatched employer_coordinate must NOT override the location's own lat")
        assert_false(compute_all_locations_c1_verified(resolved_wrong), "unmatched source coordinate still does not count as C1")
        should_publish_wrong, reason_wrong = gate_auto_publish(
            has_location_or_region=len(resolved_wrong) > 0 or len(job_recruitment_regions) > 0,
            has_application_path_=True,
        )
        assert_true(should_publish_wrong, "still publishes — coordinate mismatch/verification status is irrelevant to the gate now")
        assert_equal(reason_wrong, "ok", "publish reason must be ok")

        # ── 3) employer_coordinate가 이 근무지와 실제로 일치(DOJI 실사례) — 이 경우도 당연히 공개 ──
        real_employer_coordinate = {
            "lat": 21.029196, "lng": 105.841676,
            "contact_address": "Tầng 7 - Tòa nhà DOJI Tower - Số 5 Lê Duẩn - Ba Đình - Hà Nội",
        }
        assert_true(
            source_coordinate_matches_location(real_employer_coordinate["contact_address"], addr),
            "sanity check on the fixture: DOJI contact_address must textually match this job's own DOJI Tower address",
        )
        resolved_matched, _ = resolve_work_locations(candidates, employer_coordinate=real_employer_coordinate)
        assert_true(resolved_matched[0]["source_verified"], "employer_coordinate's contact_address matches this location -> source_verified must be True")
        assert_equal(
            (resolved_matched[0]["lat"], resolved_matched[0]["lng"]), (21.029196, 105.841676),
            "source-verified location must use the site's own employer coordinate, not Geoapify's guess",
        )
        assert_true(compute_all_locations_c1_verified(resolved_matched), "source-verified location -> still counts as C1 (relevant to map/distance-search eligibility, not to publishing)")
        should_publish_matched, reason_matched = gate_auto_publish(
            has_location_or_region=len(resolved_matched) > 0 or len(job_recruitment_regions) > 0,
            has_application_path_=True,
        )
        assert_true(should_publish_matched, "a genuinely source-verified location must of course still publish")
        assert_equal(reason_matched, "ok", "publish reason must be ok")
    finally:
        geocode._geocode_query_raw = original


class _FakeQuery:
    """Minimal stand-in for a supabase-py table/rpc call chain — records what
    was sent instead of touching a real database. Every chain method returns
    self so `.table(x).update(y).eq(a, b).execute()`-style chains work."""

    def __init__(self, calls: list[dict], kind: str, table_or_rpc: str, payload=None):
        self._calls = calls
        self._record = {"kind": kind, "table_or_rpc": table_or_rpc, "payload": payload, "filters": {}}

    def update(self, payload):
        self._record["op"] = "update"
        self._record["payload"] = payload
        return self

    def insert(self, payload):
        self._record["op"] = "insert"
        self._record["payload"] = payload
        return self

    def select(self, *_a, **_k):
        return self

    def like(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._record["filters"][col] = val
        return self

    def execute(self):
        self._calls.append(self._record)
        return type("Result", (), {"data": [{"id": self._record["filters"].get("id", 12345)}]})()


class _FakeSupabase:
    """Records every .table()/.rpc() call's final payload — see _FakeQuery."""

    def __init__(self):
        self.calls: list[dict] = []

    def table(self, name):
        return _FakeQuery(self.calls, "table", name)

    def rpc(self, name, params=None):
        return _FakeQuery(self.calls, "rpc", name, payload=params)


def _make_existing_row(**overrides) -> dict:
    row = {
        "id": 999, "origin": "crawler", "active": True, "publish_gate_reason": "ok",
        "title": "Test Job Title", "company": "Test Company",
        "salary": "10 - 15 triệu", "application_deadline": "2026-12-31",
        "description": "[source:vieclam24h] test", "location": "TP.HCM",
        "source_url": "https://vieclam24h.vn/test-job-999.html",
        "preference": "1 năm", "education": "Đại học", "work_period": "Toàn thời gian cố định",
        "num_hires": "3", "hours": None, "work_days": None,
    }
    row.update(overrides)
    return row


def _make_rerun_job(**overrides) -> dict:
    job = {
        "title": "Test Job Title", "company": "Test Company", "location": "TP.HCM",
        "salary": "10 - 15 triệu", "description": "[source:vieclam24h] test", "category": "factory",
        "posted_at": "2026-09-04", "urgent": False, "employer_phone": "",
        "application_deadline": "2026-12-31", "active": False, "origin": "crawler",
        "admin_hidden": False, "image_url": None,
        "source_url": "https://vieclam24h.vn/test-job-999.html",
        "publish_gate_reason": "no_verified_coordinate", "crawler_version": "test-version-2",
        "preference": "1 năm", "education": "Đại học", "work_period": "Toàn thời gian cố định",
        "num_hires": "3", "hours": None, "work_days": None,
        "_resolved_locations": [], "_had_transient_geocode_failure": False,
    }
    job.update(overrides)
    return job


def test_transient_geocode_failure_never_republishes_or_corrupts_existing_verified_job() -> None:
    """실사례 회귀(2026-09-04, 사용자 지시 — 신규 20건 블라인드 시험 19번
    공고 "Kỹ Sư Xây Dựng"(86/29 Trần Thái Tông)에서 Geoapify 타임아웃
    (_had_transient_geocode_failure=True) 발생): job_work_locations 동기화는
    이미 not had_transient로 보호되고 있었지만, 같은 재처리 경로에서
    local_jobs.active/publish_gate_reason 갱신은 이 보호가 없어, 이미 정상
    공개(active=true) 중이던 공고가 이번 실행 한정의 일시적 API 오류 때문에
    잘못 강등(active: true -> false)될 수 있던 결함(crawl_topcv.py 수정으로
    해결). 이 테스트는 그 수정을 실제 upsert_job_record() 경로로 검증한다
    (가짜 Supabase 클라이언트로 기록만 하고 실제 DB는 건드리지 않음)."""
    original_supabase = crawl_topcv.supabase
    fake = _FakeSupabase()
    crawl_topcv.supabase = fake
    try:
        existing = _make_existing_row()
        by_source_url = {existing["source_url"]: existing}
        by_key = {canonical_job_key(existing["title"], existing["company"]): existing}

        # 시나리오 1: 이번 실행이 geocode 일시 오류를 겪었다 — 불완전한 판정
        # (active=False)이 나왔더라도, 기존에 정상 공개 중이던 값을 절대
        # 덮어써서는 안 된다.
        # 급여도 함께 바뀐 것으로 만들어(실제 재처리에서 자유 텍스트 필드는
        # geocode 성공 여부와 무관하게 갱신되는 게 정상이므로) update() 호출
        # 자체는 실제로 일어나게 하고, 그 payload 안에 active/publish_gate_reason
        # 등 geocode 파생 필드만 정확히 빠져 있는지 확인한다 — "update가 아예
        # 안 일어남"이 아니라 "일어나되 이 필드들만 제외됨"을 검증해야 더 강한
        # 보장이 된다.
        transient_job = _make_rerun_job(_had_transient_geocode_failure=True, salary="20 - 25 triệu")
        with crawl_topcv.enable_writes():
            result = crawl_topcv.upsert_job_record(transient_job, by_source_url, by_key)
        assert_equal(result["action"], "updated", "salary genuinely changed -> update() must still run for that field")
        table_calls = [c for c in fake.calls if c["kind"] == "table" and c.get("op") == "update"]
        assert_equal(len(table_calls), 1, "exactly one update() call for the salary change")
        payload = table_calls[0]["payload"] or {}
        assert_equal(payload.get("salary"), "20 - 25 triệu", "the genuinely-changed, geocode-independent field (salary) must still be updated")
        assert_true(
            "active" not in payload and "publish_gate_reason" not in payload
            and "crawler_version" not in payload and "last_verified_at" not in payload,
            f"transient geocode failure must NOT touch active/publish_gate_reason/crawler_version/last_verified_at, got update payload {payload!r}",
        )
        rpc_calls = [c for c in fake.calls if c["kind"] == "rpc"]
        assert_equal(rpc_calls, [], "job_work_locations RPC must not run when this run's geocode result is incomplete (transient failure)")

        # 시나리오 2(대조군): 일시 오류가 없는 정상 재처리는 여전히 active/
        # publish_gate_reason을 정상적으로 갱신해야 한다 — 이 수정이 모든
        # 갱신을 막아버린 게 아님을 확인.
        fake.calls.clear()
        clean_job = _make_rerun_job(_had_transient_geocode_failure=False, active=False, publish_gate_reason="no_verified_coordinate")
        with crawl_topcv.enable_writes():
            crawl_topcv.upsert_job_record(clean_job, by_source_url, by_key)
        clean_updates = [c for c in fake.calls if c["kind"] == "table" and c.get("op") == "update"]
        assert_true(len(clean_updates) >= 1, "a clean (non-transient) re-verify with a changed active/gate_reason must still send an update")
        assert_true(
            any("active" in c["payload"] for c in clean_updates),
            "clean re-verify must update 'active' when the gate's conclusion legitimately changed",
        )
    finally:
        crawl_topcv.supabase = original_supabase


def test_job_recruitment_regions_reaches_insert_payload_after_migration_0018() -> None:
    """운영 적용 회귀(2026-09-04, migration 0018이 실제로 운영 DB에 실행된
    뒤 사용자 지시 10번 — "local_jobs.recruitment_regions 저장 코드만
    활성화"). 이전 라운드에는 이 테스트가 반대로 "recruitment_regions가
    payload에 절대 없어야 한다"를 검증했다 — 그때는 컬럼 자체가 없어서
    안전장치였다. migration 0018이 2026-09-04 실제로 적용된 뒤로는 반대가
    맞는 동작이다: build_job_record()가 채운 job["recruitment_regions"]
    (job["_job_recruitment_regions"]와 항상 같은 값)가 실제 INSERT
    payload에 올바르게 실려야 한다. "_"로 시작하는 임시 필드는 여전히,
    항상 제외돼야 한다(이건 migration과 무관한 영구 규칙)."""
    original_supabase = crawl_topcv.supabase
    fake = _FakeSupabase()
    crawl_topcv.supabase = fake
    try:
        new_job = _make_rerun_job(
            source_url="https://vieclam24h.vn/test-job-verify-only.html",
            _job_recruitment_regions=["TP.HCM", "Long An"],
            recruitment_regions=["TP.HCM", "Long An"],
        )
        # 기존 행과 매칭되지 않는 완전히 새 공고 -> INSERT 경로를 탄다.
        with crawl_topcv.enable_writes():
            result = crawl_topcv.upsert_job_record(new_job, by_source_url={}, by_key={})
        assert_equal(result["action"], "inserted", "no existing match -> must go through the INSERT path")
        insert_calls = [c for c in fake.calls if c["kind"] == "table" and c.get("op") == "insert"]
        assert_equal(len(insert_calls), 1, "exactly one insert() call")
        payload = insert_calls[0]["payload"] or {}
        assert_true(
            "recruitment_regions" in payload,
            f"after migration 0018, the real column key must reach the INSERT payload, got keys {sorted(payload.keys())!r}",
        )
        assert_equal(payload["recruitment_regions"], ["TP.HCM", "Long An"], "the value sent must match what build_job_record() computed")
        assert_true(
            "_job_recruitment_regions" not in payload,
            f"the '_'-prefixed transient field must still never leak into the INSERT payload (permanent rule, unrelated to migration state), got keys {sorted(payload.keys())!r}",
        )
        assert_true(
            all(not k.startswith("_") for k in payload),
            f"no '_'-prefixed transient field of any kind may leak into the INSERT payload, got keys {sorted(payload.keys())!r}",
        )
    finally:
        crawl_topcv.supabase = original_supabase


def test_coordinate_accuracy_never_leaks_exact_candidate_to_db() -> None:
    """실사례 회귀(2026-09-04, 사용자 지시 — 코드·DB 호환성 전수 확인 중 발견):
    운영 DB의 job_work_locations.coordinate_accuracy CHECK 제약(migration
    0015, 이미 실행됨)은 ('exact','ward','region','unresolved') 네 값만
    허용하는데, geocode.py의 'exact' -> 'exact_candidate' 개명(이전 커밋) 이후
    _work_location_rpc_rows()가 이 internal 값을 그대로 RPC payload에 흘려
    보내고 있었다 — 실제 쓰기가 재개되면 첫 exact_candidate 행에서 CHECK
    제약 위반으로 즉시 실패했을 결함(이번 라운드는 DB 쓰기 자체가 없어 아직
    실제 오류는 안 났음). _coordinate_accuracy_for_db()가 이를 막는지
    검증한다."""
    from crawl_topcv import _coordinate_accuracy_for_db, _work_location_rpc_rows

    # source_verified=True -> DB에는 'exact'로 승격, 좌표 그대로 유지.
    verified_loc = {
        "raw_address": "DOJI Tower, Số 5 Lê Duẩn", "normalized_address": "doji tower...",
        "lat": 21.029196, "lng": 105.841676, "geocode_status": "success",
        "geocode_source": "vieclam24h_employer_contact", "address_accuracy": "exact_text",
        "coordinate_accuracy": "exact_candidate", "address_evidence": "...", "source_verified": True,
    }
    tier, lat, lng, status = _coordinate_accuracy_for_db(verified_loc)
    assert_equal(tier, "exact", "source_verified=True must map to the DB-legal 'exact' value")
    assert_equal((lat, lng), (21.029196, 105.841676), "verified coordinate must be preserved as-is")
    assert_equal(status, "success", "verified location keeps geocode_status='success'")

    # exact_candidate이지만 source_verified가 아니면 -> DB에는 'unresolved'로
    # 낮추고 좌표도 null(=지도에 마커 안 뜸, 기존 unresolved 등급 의미와 일치).
    unverified_loc = {
        "raw_address": "OfficeHaus, 32 Tân Thắng", "normalized_address": "officehaus...",
        "lat": 10.7999786, "lng": 106.6147282, "geocode_status": "success",
        "geocode_source": "geoapify", "address_accuracy": "exact_text",
        "coordinate_accuracy": "exact_candidate", "address_evidence": "...", "source_verified": False,
    }
    tier2, lat2, lng2, status2 = _coordinate_accuracy_for_db(unverified_loc)
    assert_equal(tier2, "unresolved", "exact_candidate WITHOUT source verification must be downgraded to the DB-legal 'unresolved', never written as 'exact_candidate' or 'exact'")
    assert_equal((lat2, lng2), (None, None), "unverified location's coordinate must be nulled before DB storage — never show an unverified pin")
    assert_equal(status2, "failed", "unverified location's geocode_status must reflect that no trustworthy coordinate was stored")

    # ward/region/unresolved는 애초에 CHECK 제약과 호환되므로 그대로 통과.
    for tier_in in ("ward", "region", "unresolved"):
        loc = {"coordinate_accuracy": tier_in, "lat": 1.0, "lng": 2.0, "geocode_status": "success", "source_verified": False}
        tier_out, lat_out, lng_out, status_out = _coordinate_accuracy_for_db(loc)
        assert_equal(tier_out, tier_in, f"{tier_in} tier must pass through unchanged (already DB-legal)")
        assert_equal((lat_out, lng_out), (1.0, 2.0), f"{tier_in} tier's coordinate must not be touched by this mapping")

    # _work_location_rpc_rows()가 실제로 이 매핑을 적용하는지, 그리고
    # raw_address는 매핑과 무관하게 항상 그대로 보존되는지 엔드투엔드로 확인.
    rows = _work_location_rpc_rows([verified_loc, unverified_loc])
    assert_equal(rows[0]["coordinate_accuracy"], "exact", "RPC payload row 0 must carry the mapped 'exact' value")
    assert_equal(rows[0]["raw_address"], "DOJI Tower, Số 5 Lê Duẩn", "raw_address always preserved verbatim")
    assert_equal(rows[0]["location_verified"], True, "row 0 (source_verified) must carry location_verified=True in the RPC payload")
    assert_equal(rows[1]["coordinate_accuracy"], "unresolved", "RPC payload row 1 must carry the mapped 'unresolved' value, not raw 'exact_candidate'")
    assert_equal(rows[1]["raw_address"], "OfficeHaus, 32 Tân Thắng", "raw_address always preserved verbatim, even when the coordinate itself is dropped")
    assert_equal(rows[1]["lat"], None, "row 1's lat must be null in the RPC payload")
    assert_equal(rows[1]["location_verified"], False, "row 1 (not source_verified) must carry location_verified=False")


def test_strip_recruitment_region_suffix_kcn_real_case() -> None:
    """실사례(KCN Hiệp Phước 공고, 2026-09-04 실측): "알려진 모집지역 접미사"
    (특정 장소 신호가 없는 순수 행정구역 꼬리)만 반복 제거하면 4개 변형이
    모두 같은 core로 수렴해야 한다 — 번지·도로·Lô·건물·공장 신호가 있는
    segment(여기서는 "Khu Công nghiệp Hiệp Phước" 자체)는 절대 지워지지
    않는다."""
    variants = [
        "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè",
        "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Bình Chánh",
        "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Quận 7",
        "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Cần Giuộc",
    ]
    cores = {ascii_key(_strip_recruitment_region_suffix(v)) for v in variants}
    assert_equal(len(cores), 1, "all 4 real region-suffix variants must strip down to the exact same core")
    assert_equal(
        _strip_recruitment_region_suffix(variants[0]),
        "Khu Công nghiệp Hiệp Phước",
        "stripping must stop at the KCN name itself (a real specific-place signal), never remove it",
    )


def test_group_candidates_by_core_location_kcn_facility_dedup() -> None:
    """실사례 회귀(2026-09-04, "+N 모집지역" 실제 공고 24건 조사 중 발견):
    KCN Hiệp Phước 공고("Tuyển Công Nhân Sản Xuất Tại KCN Hiệp Phước, Nhà Bè",
    https://vieclam24h.vn/.../cong-nhan-san-xuat-tai-kcn-hiep-phuoc-nha-be-
    c10p122id200908817.html)의 'Địa điểm làm việc' 섹션을 실제 라이브 페이지에서
    그대로 대조한 4개 항목 — 같은 산업단지가 모집지역 접미사만 바뀐 채 4번
    나열된다. core(알려진 모집지역 접미사 제거)가 전부 같으므로 하나의
    근무구역으로 묶여야 한다."""
    candidates = [
        {"text": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè", "region_prefix": "TP.HCM"},
        {"text": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Bình Chánh", "region_prefix": "TP.HCM"},
        {"text": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Quận 7", "region_prefix": "TP.HCM"},
        {"text": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Cần Giuộc", "region_prefix": "Long An"},
    ]
    groups = _group_candidates_by_core_location(candidates)
    assert_equal(len(groups), 1, "all 4 region-suffix variants of the same KCN must collapse into exactly 1 work-location group")
    assert_equal(len(groups[0]["members"]), 4, "the single group must retain all 4 original candidates as members")

    representative = _select_group_representative(groups[0]["members"])
    assert_equal(
        representative["text"], "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè",
        "all 4 members tie on specificity (only the KCN name itself carries a signal) -> shortest wins as the tie-break only",
    )


def test_group_candidates_by_core_location_plain_address_region_suffix() -> None:
    """시설명(KCN 등)이 없는 일반 번지 주소도, 신호 없는 꼬리(순수 지역
    접미사)만 다르면 같은 근무구역으로 묶여야 한다."""
    candidates = [
        {"text": "45 Trần Mai Ninh, Tân Bình, TP.HCM", "region_prefix": "TP.HCM"},
        {"text": "45 Trần Mai Ninh, Tân Bình, TP.HCM, Bình Dương", "region_prefix": "Bình Dương"},
    ]
    groups = _group_candidates_by_core_location(candidates)
    assert_equal(len(groups), 1, "same address with only a trailing region tag appended must merge into 1 group")
    representative = _select_group_representative(groups[0]["members"])
    assert_equal(representative["text"], "45 Trần Mai Ninh, Tân Bình, TP.HCM", "tied specificity -> shorter (no trailing tag) variant wins as tie-break")


def test_group_candidates_by_core_location_does_not_merge_different_places() -> None:
    """서로 다른 시설명, 서로 다른 번지, 또는 같은 KCN 안의 서로 다른
    lot·도로·공장은 절대 하나로 묶이면 안 된다 — 우연히 같은 거리/단지 이름을
    공유해도 실제 특정 장소 신호가 다르면 다른 건물일 수 있다."""
    # 완전히 다른 두 KCN(시설명 자체가 다름).
    different_facilities = [
        {"text": "KCN Hiệp Phước, xã Hiệp Phước, Nhà Bè", "region_prefix": "TP.HCM"},
        {"text": "KCN Tân Tạo, Bình Tân", "region_prefix": "TP.HCM"},
    ]
    groups_a = _group_candidates_by_core_location(different_facilities)
    assert_equal(len(groups_a), 2, "two different named industrial parks must NOT be merged")

    # 같은 거리 이름이지만 번지가 다른 두 일반 주소.
    different_house_numbers = [
        {"text": "12 Nguyễn Trãi, Quận 1", "region_prefix": "TP.HCM"},
        {"text": "45 Nguyễn Trãi, Quận 5", "region_prefix": "TP.HCM"},
    ]
    groups_b = _group_candidates_by_core_location(different_house_numbers)
    assert_equal(len(groups_b), 2, "different house numbers on the same-named street must NOT be merged")

    # 사용자 지시(2026-09-04, "반복주소 대표값 선정 수정"): "같은 KCN 안의
    # 서로 다른 lot·도로·공장까지 잘못 병합하지 않는 테스트 추가" — 같은
    # KCN 이름이라도 서로 다른 Lô/도로가 명시되면(실제 특정 장소 신호가
    # 다름) 절대 병합되면 안 된다.
    same_kcn_different_lots = [
        {"text": "KCN ABC, Lô A1, Đường số 5, Quận 9", "region_prefix": "TP.HCM"},
        {"text": "KCN ABC, Lô B2, Đường số 8, Quận 9", "region_prefix": "TP.HCM"},
    ]
    groups_c = _group_candidates_by_core_location(same_kcn_different_lots)
    assert_equal(len(groups_c), 2, "same KCN name but different lot/road within it must NOT be merged")
    assert_equal(
        {ascii_key(_strip_recruitment_region_suffix(c["text"])) for c in same_kcn_different_lots},
        {ascii_key("KCN ABC, Lô A1, Đường số 5"), ascii_key("KCN ABC, Lô B2, Đường số 8")},
        "the road segment (a real specific-place signal) must survive stripping and keep the two cores distinct",
    )

    # 같은 KCN + 같은 lot/도로인데 모집지역 접미사만 다른 경우는 정상적으로
    # 병합돼야 한다(위 부정 케이스와의 대조군).
    same_kcn_same_lot_different_suffix = [
        {"text": "KCN ABC, Lô A1, Đường số 5, Quận 9", "region_prefix": "TP.HCM"},
        {"text": "KCN ABC, Lô A1, Đường số 5, Quận 9, Bình Chánh", "region_prefix": "TP.HCM"},
    ]
    groups_d = _group_candidates_by_core_location(same_kcn_same_lot_different_suffix)
    assert_equal(len(groups_d), 1, "same lot/road with only an extra trailing recruitment-region tag must still merge")


def test_select_group_representative_prefers_specificity_over_shortest_string() -> None:
    """사용자 지시(2026-09-04): "가장 짧은 문자열을 상세주소 대표값으로
    사용하지 않음 — 저장할 raw_address는 번지·도로·lot·건물·공장 정보가
    가장 구체적인 원문 후보를 선택. 최단 core는 중복 그룹 키와 검색어
    정리에만 사용." _select_group_representative()가 실제로 specificity를
    1순위로 쓰고, 길이는 동점일 때만 보조 기준으로 쓰는지 직접 확인한다
    (그룹핑 자체가 만드는 자연스러운 동점 상황에 기대지 않고, 인위적으로
    specificity가 다른 멤버를 넣어 검증)."""
    assert_equal(_specificity_score("45 Nguyễn Trãi"), 1, "sanity: a house number alone is 1 specific-place signal")
    assert_equal(_specificity_score("Lô 5, 45 Nguyễn Trãi"), 2, "sanity: Lô + house number is 2 specific-place signals")

    # specificity가 다르면, 더 긴(더 구체적인) 쪽이 이겨야 한다 — "짧은 문자열"
    # 규칙이었다면 틀린 답(첫 번째)을 골랐을 것이다.
    higher_specificity_but_longer = [
        {"text": "45 Nguyễn Trãi", "region_prefix": "TP.HCM"},
        {"text": "Lô 5, 45 Nguyễn Trãi", "region_prefix": "TP.HCM"},
    ]
    rep = _select_group_representative(higher_specificity_but_longer)
    assert_equal(rep["text"], "Lô 5, 45 Nguyễn Trãi", "member with MORE specific-place signals must win even though it is the longer string")

    # specificity가 동점일 때만(실제 그룹핑에서 흔한 경우) 최단 문자열이
    # 보조 기준으로 결정한다.
    tied_specificity = [
        {"text": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Bình Chánh", "region_prefix": "TP.HCM"},
        {"text": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè", "region_prefix": "TP.HCM"},
    ]
    rep2 = _select_group_representative(tied_specificity)
    assert_equal(rep2["text"], "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè", "tied specificity -> shortest is only a tie-break, not the primary rule")


def test_resolve_work_locations_dedupes_repeated_core_address_and_collects_matched_recruitment_regions() -> None:
    """엔드투엔드 회귀(2026-09-04, 반복주소 수정 + 대표값 선정 수정): KCN Hiệp
    Phước 실사례 4개 후보를 resolve_work_locations()에 그대로 넣으면 — 결과
    행은 1개뿐이고, raw_address는 대표(동점 상황에서 최단) 원문 그대로
    보존되며, geocode 검색어는 "알려진 모집지역 접미사"를 제거한 core로
    정리되어 전송된다(원문 그대로가 아님 — Bình Chánh/Quận 7/Cần Giuộc 같은
    접미사가 쿼리에 섞이면 Geoapify가 그쪽으로 편향된다는 게 실측 원인이었음).
    matched_recruitment_regions에 4개 후보의 서로 다른 지역 라벨(TP.HCM,
    Long An)이 중복 없이 전부 모여야 한다."""
    original = geocode._geocode_query_raw

    def _success(lat, lng, result_type, state=None, county=None, city=None, name=None, street=None):
        return {
            "status": "success", "lat": lat, "lng": lng,
            "top": {"result_type": result_type, "state": state, "county": county, "city": city, "name": name, "street": street},
        }

    try:
        short_addr = "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè"
        long_addr_variants = [
            "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Bình Chánh",
            "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Quận 7",
            "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, huyện Nhà Bè, Thành phồ Hồ Chí Minh, Cần Giuộc",
        ]
        recruitment_tag_words = ["binh chanh", "quan 7", "can giuoc"]
        point = _success(10.7227835, 106.703405, "building", state="Ho Chi Minh", city="Nha Be", name="Khu Cong nghiep Hiep Phuoc", street="Khu Cong nghiep Hiep Phuoc")

        def _fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            q_key = ascii_key(query)
            for tag in recruitment_tag_words:
                assert_false(tag in q_key, f"recruitment-region tag {tag!r} must never leak into the geocode query text: {query!r}")
            if "khu cong nghiep hiep phuoc" in q_key:
                return point
            return {"status": "no_results", "lat": None, "lng": None, "top": None}

        geocode._geocode_query_raw = _fake

        candidates = [
            {"text": short_addr, "region_prefix": "TP.HCM"},
            {"text": long_addr_variants[0], "region_prefix": "TP.HCM"},
            {"text": long_addr_variants[1], "region_prefix": "TP.HCM"},
            {"text": long_addr_variants[2], "region_prefix": "Long An"},
        ]
        resolved, had_transient_failure = resolve_work_locations(candidates)
        assert_false(had_transient_failure, "no transient failures expected in this fixture")
        assert_equal(len(resolved), 1, "4 region-suffix variants of the same physical KCN must collapse into exactly 1 resolved row, not 4")
        assert_equal(resolved[0]["raw_address"], short_addr, "stored raw_address must be the representative original text, never the stripped geocode-query core")
        assert_equal(resolved[0]["coordinate_accuracy"], "exact_candidate", "the cleaned query must actually resolve successfully (sanity: fake geocoder was reached with a valid query)")
        assert_equal(
            resolved[0]["matched_recruitment_regions"], ["TP.HCM", "Long An"],
            "the single row must carry both distinct recruitment regions (dedup, first-seen order), not duplicate coordinates across 4 rows",
        )
    finally:
        geocode._geocode_query_raw = original


def test_resolve_work_locations_geocodes_single_candidate_unstripped() -> None:
    """중복(그룹 멤버 2개 이상)이 없는 단일 후보는 core 정리를 거치지 않고
    원문 그대로 geocode한다 — 불필요하게 행정구역 상세 정보(구/시)를 잃지
    않기 위함(사용자 지시: "최단 core는 중복 그룹 키와 검색어 정리에만
    사용" — 중복이 없으면 애초에 정리할 이유도 없다)."""
    original = geocode._geocode_query_raw
    try:
        addr = "45 Trần Mai Ninh, Tân Bình, TP.HCM"

        def _fake(query_text_for_cache, query, bias_province=None, bbox_rect=None):
            assert_true("tan binh" in ascii_key(query), "single (non-duplicate) candidate must be geocoded with its full original text, unstripped")
            return {"status": "no_results", "lat": None, "lng": None, "top": None}

        geocode._geocode_query_raw = _fake
        resolved, _ = resolve_work_locations([{"text": addr, "region_prefix": "TP.HCM"}])
        assert_equal(len(resolved), 1, "single real address still gets a row")
    finally:
        geocode._geocode_query_raw = original


def test_work_location_rpc_rows_includes_matched_recruitment_regions() -> None:
    """_work_location_rpc_rows()가 matched_recruitment_regions를 RPC
    payload에 그대로 전달하는지 확인 — draft migration 0018이 실행되기
    전까지는 현재 RPC가 이 키를 조용히 무시하지만(하위 호환), payload
    자체는 항상 포함해야 migration 실행 즉시 저장되기 시작한다."""
    from crawl_topcv import _work_location_rpc_rows

    loc = {
        "raw_address": "Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè",
        "normalized_address": "khu cong nghiep hiep phuoc...",
        "lat": 10.7227835, "lng": 106.703405, "geocode_status": "success",
        "geocode_source": "geoapify", "address_accuracy": "exact_text",
        "coordinate_accuracy": "ward", "address_evidence": "...", "source_verified": False,
        "matched_recruitment_regions": ["TP.HCM", "Long An"],
    }
    rows = _work_location_rpc_rows([loc])
    assert_equal(rows[0]["matched_recruitment_regions"], ["TP.HCM", "Long An"], "matched_recruitment_regions must pass through to the RPC payload unchanged")

    loc_no_regions = {**loc, "matched_recruitment_regions": []}
    rows2 = _work_location_rpc_rows([loc_no_regions])
    assert_equal(rows2[0]["matched_recruitment_regions"], [], "missing/empty matched_recruitment_regions must default to an empty list, never null/KeyError")


def test_compute_job_recruitment_regions_survives_zero_work_location_rows() -> None:
    """사용자 지시(2026-09-04, "recruitment_regions 저장 위치 확인"): "공고
    전체 모집지역은 근무지 행이 0건이어도 보존되어야 함." split_work_
    locations()의 원본 후보 전체(region_prefix가 있는 모든 candidate) 기준
    이라, 그 중 하나도 'exact' 주소로 분류되지 않아 job_work_locations 행이
    0건인 경우에도 지역 라벨 자체는 그대로 남는다."""
    from crawl_topcv import _compute_job_recruitment_regions

    # 전부 region_only(번지/시설명 등 구체 신호 없음)라 resolve_work_locations()
    # 에서는 전원 걸러져 행이 0건이 되는 상황을 흉내낸다 — 그래도 원본
    # candidate 목록 자체에는 region_prefix가 살아있다.
    work_locations = [
        {"text": "Bắc Ninh", "region_prefix": "Bắc Ninh"},
        {"text": "Bình Dương", "region_prefix": "Bình Dương"},
        {"text": "Long An", "region_prefix": "Long An"},
        {"text": "Đà Nẵng", "region_prefix": "Đà Nẵng"},
    ]
    for wl in work_locations:
        assert_equal(classify_work_location_candidate(wl["text"]), "region_only", "sanity: bare province names never classify as 'exact' -> 0 job_work_locations rows")

    regions = _compute_job_recruitment_regions(work_locations)
    assert_equal(regions, ["Bắc Ninh", "Bình Dương", "Long An", "Đà Nẵng"], "job-level recruitment_regions must survive even when every candidate is dropped before any job_work_locations row is created")

    assert_equal(_compute_job_recruitment_regions([]), [], "no candidates at all -> empty list, never an error")
    assert_equal(
        _compute_job_recruitment_regions([{"text": "x", "region_prefix": "TP.HCM"}, {"text": "y", "region_prefix": "TP.HCM"}]),
        ["TP.HCM"],
        "duplicate region_prefix values across candidates must be deduped",
    )


def test_verify_write_forces_active_false_admin_hidden_true_even_when_caller_tries_to_override() -> None:
    """운영 적용 준비 회귀(2026-09-04, 사용자 지시 3/9번): verify_write=True일
    때 upsert_job_record()가 INSERT payload의 active/admin_hidden/origin을
    "마지막 단계"에서 강제로 덮어쓰는지 — 호출자가 job dict에 이미 정반대
    값(active=True, admin_hidden=False)을 넣어 전달해도 절대 그 값이
    실제 INSERT에 반영되지 않는지("호출자가 덮어쓸 수 없는지") 확인한다."""
    original_supabase = crawl_topcv.supabase
    fake = _FakeSupabase()
    crawl_topcv.supabase = fake
    try:
        # 호출자가 의도적으로 "공개" 값을 넣어 verify_write 강제를 무력화하려는
        # 시나리오를 흉내낸다.
        job = _make_rerun_job(
            source_url="https://vieclam24h.vn/verify-write-override-attempt.html",
            active=True, admin_hidden=False, origin="crawler",
        )
        with crawl_topcv.enable_writes():
            result = crawl_topcv.upsert_job_record(job, by_source_url={}, by_key={}, verify_write=True)
        assert_equal(result["action"], "inserted", "no existing match -> INSERT path")
        assert_true(result.get("verify_write") is True, "result must clearly mark this as a verify-write save (사용자 지시 6번)")
        insert_calls = [c for c in fake.calls if c["kind"] == "table" and c.get("op") == "insert"]
        assert_equal(len(insert_calls), 1, "exactly one insert() call")
        payload = insert_calls[0]["payload"] or {}
        assert_equal(payload.get("active"), False, "verify_write must force active=False in the actual INSERT payload, regardless of what the caller's job dict said")
        assert_equal(payload.get("admin_hidden"), True, "verify_write must force admin_hidden=True in the actual INSERT payload, regardless of what the caller's job dict said")
        assert_equal(payload.get("origin"), "crawler", "verify_write must force/confirm origin='crawler'")
    finally:
        crawl_topcv.supabase = original_supabase


def test_verify_write_rejects_existing_match_without_writing() -> None:
    """운영 적용 준비 회귀(2026-09-04, 사용자 지시 5번): 검증 모드는 신규
    INSERT만 허용한다 — 같은 source_url(canonical key)의 기존 공고가
    발견되면 VerifyWriteExistingMatchError로 즉시 중단하고, insert()도
    update()도 단 한 번도 호출되지 않아야 한다."""
    original_supabase = crawl_topcv.supabase
    fake = _FakeSupabase()
    crawl_topcv.supabase = fake
    try:
        existing = _make_existing_row()
        by_source_url = {existing["source_url"]: existing}
        by_key = {canonical_job_key(existing["title"], existing["company"]): existing}
        job = _make_rerun_job(source_url=existing["source_url"])

        raised = False
        try:
            with crawl_topcv.enable_writes():
                crawl_topcv.upsert_job_record(job, by_source_url, by_key, verify_write=True)
        except VerifyWriteExistingMatchError:
            raised = True
        assert_true(raised, "verify_write against an already-existing source_url must raise VerifyWriteExistingMatchError")
        assert_equal(fake.calls, [], "no insert() or update() call may happen when verify_write hits an existing match")
    finally:
        crawl_topcv.supabase = original_supabase


def test_reprocess_jobs_has_no_verify_write_parameter() -> None:
    """운영 적용 준비 회귀(2026-09-04, 사용자 지시 4/5번): "기존 공고 UPDATE
    경로에서는 --verify-write 사용 금지". reprocess_jobs()는 UPDATE 전용
    경로(항상 기존 local_jobs id를 재처리)이므로, verify_write를 애초에
    파라미터로도 받지 않아야 한다 — CLI 레벨 검증에만 의존하지 않고,
    함수 시그니처 자체가 그 경로로는 절대 전달될 수 없음을 구조적으로
    보장하는지 확인한다."""
    sig = inspect.signature(crawl_topcv.reprocess_jobs)
    assert_true(
        "verify_write" not in sig.parameters,
        "reprocess_jobs() must not accept a verify_write parameter at all — the UPDATE-only path must be structurally incapable of receiving it",
    )


def test_normal_crawl_path_never_references_verify_write() -> None:
    """운영 적용 준비 회귀(2026-09-04, 사용자 지시 4번): "일반 크롤링 경로...
    에서 --verify-write가 잘못 전달되지 않도록 분리". save_to_supabase()
    (카테고리 전체 크롤이 쓰는 유일한 저장 진입점)의 소스 코드 자체에
    "verify_write" 문자열이 전혀 없는지 확인한다 — 이 함수가
    upsert_job_record()를 호출하는 자리에 verify_write가 실수로라도
    끼어들 여지 자체가 없음을 뜻한다."""
    source = inspect.getsource(crawl_topcv.save_to_supabase)
    assert_true(
        "verify_write" not in source,
        "save_to_supabase()(normal crawl path) must never reference verify_write in any form",
    )


def test_process_urls_verify_write_generates_manifest_with_created_ids() -> None:
    """운영 적용 준비 회귀(2026-09-04, 사용자 지시 6/7번): "저장된 검증 공고
    ID를 실행 결과 JSON에 명확히 출력" + "3~5건 중 일부만 실패하면 생성된
    ID 목록으로 정확히 원상복구할 수 있도록 manifest 생성". 신규/기존
    매칭/파이프라인 실패 3가지가 섞인 배치를 넣어 각각 정확한 status로
    기록되고, created_ids에는 실제로 생성된 것만 담기며, manifest가 디스크
    파일로도 저장되는지 확인한다(브라우저/네트워크는 fake로 대체)."""
    original_supabase = crawl_topcv.supabase
    original_browser_page = crawl_topcv.browser_page
    original_process_job_url = crawl_topcv.process_job_url
    original_load_lookup = crawl_topcv.load_existing_lookup_maps
    fake = _FakeSupabase()
    crawl_topcv.supabase = fake

    existing_row = _make_existing_row(source_url="https://vieclam24h.vn/verify-write-existing.html")
    crawl_topcv.load_existing_lookup_maps = lambda: (
        {existing_row["source_url"]: existing_row},
        {canonical_job_key(existing_row["title"], existing_row["company"]): existing_row},
    )

    @asynccontextmanager
    async def fake_browser_page():
        yield None
    crawl_topcv.browser_page = fake_browser_page

    async def fake_process_job_url(page, url, listing_hint=None):
        if url == existing_row["source_url"]:
            return _make_rerun_job(source_url=url, title=existing_row["title"], company=existing_row["company"])
        if "fail" in url:
            return {"source_url": url, "title": "Fail Job Title", "company": "Fail Job Co", "_pipeline_failed": True, "_failure_stage": "detail_fetch", "_failure_reason": "boom"}
        # _make_rerun_job()의 기본 title/company("Test Job Title"/"Test Company")는
        # _make_existing_row()의 기본값과 동일하므로, source_url이 달라도
        # canonical_job_key로 우연히 existing_row와 매칭돼버린다 — 신규 후보는
        # 반드시 서로 다른 title/company를 줘서 이 우연한 충돌을 피한다.
        return _make_rerun_job(source_url=url, title="Brand New Job Title", company="Brand New Co")
    crawl_topcv.process_job_url = fake_process_job_url

    manifest = None
    try:
        urls = [
            "https://vieclam24h.vn/verify-write-new-a.html",
            existing_row["source_url"],
            "https://vieclam24h.vn/verify-write-fail-b.html",
        ]
        manifest = asyncio.run(crawl_topcv.process_urls_verify_write(urls))
        statuses = {e["url"]: e["status"] for e in manifest["entries"]}
        assert_equal(statuses[urls[0]], "created", "brand-new URL must be created")
        assert_equal(statuses[urls[1]], "skipped_existing", "URL matching an existing row must be skipped, never written")
        assert_equal(statuses[urls[2]], "failed", "a pipeline failure must be recorded as failed, not silently dropped, and must not abort the rest of the batch")
        assert_equal(len(manifest["created_ids"]), 1, "created_ids must contain exactly the 1 successfully created id, not the skipped/failed ones")
        assert_true(os.path.exists(manifest["manifest_path"]), "the manifest must actually be written to a JSON file on disk (so a partial-failure batch can still be cleaned up precisely)")
        with open(manifest["manifest_path"], encoding="utf-8") as f:
            on_disk = __import__("json").load(f)
        assert_equal(on_disk["created_ids"], manifest["created_ids"], "the on-disk manifest file must match the returned manifest")
    finally:
        crawl_topcv.supabase = original_supabase
        crawl_topcv.browser_page = original_browser_page
        crawl_topcv.process_job_url = original_process_job_url
        crawl_topcv.load_existing_lookup_maps = original_load_lookup
        if manifest and manifest.get("manifest_path") and os.path.exists(manifest["manifest_path"]):
            os.remove(manifest["manifest_path"])


def test_verify_write_created_jobs_excluded_from_public_home_search_map_query() -> None:
    """운영 적용 준비 회귀(2026-09-04, 사용자 지시 8번): "verify-write로
    생성된 공고가 홈·검색·지도·API 공개 쿼리에 노출되지 않는" 것을 보장하는
    두 층을 함께 확인한다:
    1. (이 테스트 파일, 크롤러 쪽) verify_write는 항상 active=False를 강제
       한다 — 위 test_verify_write_forces_active_false_...로 이미 별도
       검증됨(여기서는 전제로만 재확인).
    2. (프론트, src/context/JobsContext.tsx) Home/검색/지도가 전부 공유하는
       단 하나의 공개 조회 경로(useJobs())가 local_jobs를 select할 때
       ".eq('active', true)"로 반드시 필터링하는지 — 소스 텍스트를 직접
       읽어 그 필터가 local_jobs 조회 바로 다음 줄에 있는지 확인한다(이
       필터가 실수로 제거되면 이 테스트가 실패해야 한다).

    **중요, 확인된 한계(수정하지 않음, 보고만)**: 이 필터는 앱(JobsContext.tsx)
    레벨에서만 적용된다 — supabase/migrations/0005의 local_jobs_public_select
    RLS 정책은 `using (true)`로, anon key로 PostgREST REST API를 직접
    호출하면 active/admin_hidden과 무관하게 모든 행을 읽을 수 있다(RLS가
    active를 걸러주지 않음). 즉 "홈·검색·지도"(앱 UI)는 이 필터로 보장되지만,
    "API"(원문 그대로의 PostgREST 엔드포인트)는 이 필터의 보호를 받지 않는다
    — 이는 verify-write로 새로 생기는 문제가 아니라 이미 존재하던 모든
    active=false 행에 똑같이 적용되는 기존 구조적 한계이며, RLS 정책 변경은
    STRICT 등급(Auth/RLS)이라 사용자 승인 없이 여기서 고치지 않는다."""
    assert_true(crawl_topcv is not None, "sanity — layer 1 (verify_write forces active=False) is covered by a separate dedicated test above")

    jobs_context_path = os.path.join(os.path.dirname(__file__), "..", "src", "context", "JobsContext.tsx")
    with open(jobs_context_path, encoding="utf-8") as f:
        source = f.read()

    select_idx = source.find(".from('local_jobs')")
    assert_true(select_idx != -1, "JobsContext.tsx must still have exactly one public local_jobs query to check")
    # 그 쿼리 체인 바로 다음(다음 300자 이내)에 active=true 필터가 있어야 한다 —
    # 이 필터가 다른 곳으로 옮겨지거나 삭제되면 이 테스트가 실패해야 한다.
    window = source[select_idx:select_idx + 400]
    assert_true(
        ".eq('active', true)" in window,
        "the public local_jobs query in JobsContext.tsx (shared by Home/search/map via useJobs()) must filter .eq('active', true) — "
        "if this assertion fails, a verify-write (or any inactive) job could leak into the public UI",
    )


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
        test_source_coordinate_matches_location,
        test_resolve_coordinate_accuracy_tiers_with_mocked_geocoder,
        test_resolve_coordinate_accuracy_is_deterministic_given_fixed_fixture,
        test_resolve_coordinate_accuracy_distinguishes_transient_api_error_from_confirmed_no_results,
        test_largest_cluster_within_km,
        test_bbox_for_province,
        test_haversine_and_duplicate_detection,
        test_resolve_work_locations_no_api_key_is_not_a_transient_failure,
        test_resolve_work_locations_preserves_region_only_candidates_as_rows,
        test_gate_publishes_partially_verified_mixed_tiers,
        test_gate_publishes_regardless_of_coordinate_verification_tier,
        test_transient_geocode_failure_never_republishes_or_corrupts_existing_verified_job,
        test_job_recruitment_regions_reaches_insert_payload_after_migration_0018,
        test_coordinate_accuracy_never_leaks_exact_candidate_to_db,
        test_strip_recruitment_region_suffix_kcn_real_case,
        test_group_candidates_by_core_location_kcn_facility_dedup,
        test_group_candidates_by_core_location_plain_address_region_suffix,
        test_group_candidates_by_core_location_does_not_merge_different_places,
        test_select_group_representative_prefers_specificity_over_shortest_string,
        test_resolve_work_locations_dedupes_repeated_core_address_and_collects_matched_recruitment_regions,
        test_resolve_work_locations_geocodes_single_candidate_unstripped,
        test_work_location_rpc_rows_includes_matched_recruitment_regions,
        test_compute_job_recruitment_regions_survives_zero_work_location_rows,
        test_verify_write_forces_active_false_admin_hidden_true_even_when_caller_tries_to_override,
        test_verify_write_rejects_existing_match_without_writing,
        test_reprocess_jobs_has_no_verify_write_parameter,
        test_normal_crawl_path_never_references_verify_write,
        test_process_urls_verify_write_generates_manifest_with_created_ids,
        test_verify_write_created_jobs_excluded_from_public_home_search_map_query,
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

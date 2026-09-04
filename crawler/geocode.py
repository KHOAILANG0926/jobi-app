"""
Geoapify Geocoding API 연동 — 기존 지도 타일에 쓰는 것과 같은 Geoapify 키를
server-side(크롤러)에서 재사용한다. 새 provider/키를 추가하지 않는다.

geocode_address(raw_address, region_hint="Vietnam") -> dict | None
  성공: {"lat": float, "lng": float, "source": "geoapify", "raw_response": dict}
  실패(키 없음/API 에러/무응답/결과 없음): None — 절대 예외로 죽지 않고 로그만 남긴다.

geocode_cache(query_text=주소 정규화 키)를 먼저 조회해서 있으면 그대로 쓰고 API를
안 부른다. 새로 조회했으면(성공이든 "결과 없음"이든) 캐시에 남겨서, 같은 주소를
매번 다시 API에 묻지 않게 한다.
"""
from __future__ import annotations

import logging
import os
import re
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

from job_quality import PROVINCE_COORDS, ascii_key, guess_province_from_text, normalize_whitespace
from vn_province_merger_2025 import canonical_province_name_2025, merged_province_group

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "")
GEOAPIFY_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
_supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Reuses job_quality.py's 29-province coordinate table (already kept in sync
# with src/data/jobRegions.ts's canonical province list) so every recognized
# province gets a proximity bias, not just Hồ Chí Minh. Confirmed empirically
# this matters a lot: a batch of 10 real vieclam24h addresses geocoded with
# no bias at all (the previous state — bias_province was never actually
# wired to a real province, every call effectively got none) came back with
# confidence 0-0.45 for ALL 10, several resolving to the wrong province
# entirely (e.g. a Hưng Yên KCN resolving into Đắk Nông). This is a `bias=
# proximity:...` (soft re-ranking) rather than the earlier `filter=circle:...`
# (hard exclusion) — provinces can span well over the old ~30km circle
# radius, and a hard filter would just return zero results for anything
# genuinely that far from the nominal center instead of improving ranking.
REGION_BIAS_CENTERS: dict[str, tuple[float, float]] = {
    name: (lat, lng) for name, (lat, lng) in PROVINCE_COORDS.items()
}


def resolve_bias_province(region_prefix: str | None) -> str | None:
    """Turns a raw region label (e.g. vieclam24h's 'Bình Dương:' line prefix)
    into a REGION_BIAS_CENTERS key, reusing job_quality.py's existing
    province-recognition function rather than a second alias table. Returns
    None for unrecognized text (e.g. 'Bình Dương' itself — deliberately not
    in the canonical post-2025-merger province list, see job_quality.py) —
    callers just get no bias in that case, not an error."""
    if not region_prefix:
        return None
    return guess_province_from_text(region_prefix)


def _bbox_for_province(province: str) -> tuple[float, float, float, float] | None:
    """Crude bounding box (+-0.6 lat, +-0.7 lng, ~65-75km) around a
    province's nominal center — used only by the cascade's dedicated 'bbox'
    hard-filter query variant (strategy 6). This is an approximation, NOT a
    real administrative boundary polygon (not available to this project) —
    good enough to rule out results in a clearly different part of the
    country, not precise enough to trust on its own for anything narrower."""
    center = REGION_BIAS_CENTERS.get(province)
    if not center:
        return None
    lat, lng = center
    return (lng - 0.7, lat - 0.6, lng + 0.7, lat + 0.6)


# Geoapify's own docs: confidence >=0.95 is a confirmed match, <0.2 should be
# rejected outright, and 0.2–0.95 is a "needs further checking" band. A wrong-
# province match we saw directly (Bình Dương instead of Tân Phú) still scored
# 0.9 confidence — high confidence only means "the text matched something",
# not "the right something" — so this threshold is a deliberately conservative
# cut inside that gray band, meant to work together with the region-text
# match check above (not replace it).
MIN_CONFIDENCE = 0.5


def _cache_key(raw_address: str, region_hint: str, expected_region_text: str | None) -> str:
    """geocode_cache.query_text로 쓰는 안정적인 dedup 키. region_hint/
    expected_region_text가 결과(채택 여부)에 영향을 주므로 캐시 키에도 포함한다
    — 안 그러면 같은 주소를 다른 조건으로 다시 geocode할 때 엉뚱한 캐시를
    재사용하게 된다. 실제 API에는 원문 raw_address를 그대로 보낸다(정확도용)
    — 이건 캐시 매칭 전용."""
    return ascii_key(f"{raw_address}|{region_hint}|{expected_region_text or ''}")


def _read_cache(query_text: str) -> dict | None:
    if not _supabase:
        return None
    try:
        resp = (
            _supabase.table("geocode_cache")
            .select("lat,lng,source,raw_response")
            .eq("query_text", query_text)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return None
        row = rows[0]
        raw_response = row.get("raw_response") or {}
        # geocode_cache has no dedicated 'status' column — it's embedded in
        # raw_response._status by _write_cache() below (see there for why).
        status = raw_response.get("_status") or ("success" if row.get("lat") is not None else "no_results")
        return {
            "lat": row.get("lat"), "lng": row.get("lng"),
            "source": row.get("source") or "geoapify",
            "status": status,
            "raw_response": raw_response,
        }
    except Exception as exc:
        logger.warning("geocode_cache 조회 실패: %s", exc)
        return None


def _write_cache(query_text: str, lat, lng, source: str, raw_response: dict, status: str) -> None:
    if not _supabase:
        return
    try:
        # geocode_cache.raw_response has no sibling 'status' column (checked
        # the live schema) — rather than add one for an internal cache table,
        # the status rides along inside the same jsonb blob under '_status'
        # so a cache hit can still tell 'no_results' apart from 'api_error'
        # (api_error is deliberately never cached at all — see geocode_address).
        stored_response = {**(raw_response or {}), "_status": status}
        _supabase.table("geocode_cache").upsert(
            {"query_text": query_text, "lat": lat, "lng": lng, "source": source, "raw_response": stored_response},
            on_conflict="query_text",
        ).execute()
    except Exception as exc:
        logger.warning("geocode_cache 저장 실패: %s", exc)


# Pure notation variants of the SAME province (never a merger, just how
# vieclam24h/Geoapify happen to write it) — always safe to treat as equal in
# either direction.
_REGION_NOTATION_VARIANTS: list[set[str]] = [
    {"tp hcm", "tp. hcm", "ho chi minh", "thanh pho ho chi minh", "hcm", "sai gon", "sg"},
    {"ha noi", "tp ha noi", "thu do ha noi", "hn"},
    {"hue", "thua thien hue", "thua thien - hue"},
]

def _region_segments(field_value: object) -> list[str]:
    """ascii-folds a Geoapify field and splits it on comma/slash — matching
    is only ever done WITHIN one segment, never across a comma boundary.
    Concatenating fields (or matching across commas within one field) was
    tried first and rejected: it created false positives like expected
    "Long An" matching a formatted address "..., Vĩnh Long, An Nhơn, ..."
    purely because "Vĩnh LONG" + "AN Nhơn" happen to sit next to each other
    — two unrelated real places (Vĩnh Long province, An Nhơn town in Bình
    Định) that must never be confused with Long An province."""
    return [s for s in (ascii_key(seg) for seg in str(field_value or "").split(",")) if s]


def _region_text_matches(top: dict, expected_region_text: str | None) -> bool:
    """Best-effort text comparison instead of a hand-maintained ISO 3166-2:VN
    table (none of this project's own data confirms every code, and a wrong
    hardcoded code would silently reject good matches or accept bad ones —
    worse than not checking). Compares the caller's expected province/region
    name against every region-shaped field Geoapify returns (state/county/
    city/formatted/address_line2), segment by segment (see _region_segments)
    — a match in ANY segment counts, since Vietnamese administrative naming
    in OSM-derived data is inconsistent about which field carries the
    province name.

    Also treats any two provinces merged into the same unit by Vietnam's 2025
    administrative merger (vn_province_merger_2025.PROVINCE_MERGER_VERSION —
    e.g. Long An+Tây Ninh -> new Tây Ninh, Bình Dương+Bà Rịa-Vũng Tàu+TP.HCM
    -> new TP.HCM) as the SAME region, in either direction: the raw address
    text may use the old or new name, and Geoapify/OSM data (which lags real-
    world administrative changes) may also return either — general, versioned
    data, not a per-province exception. This only decides "is it the same
    province" — it does not by itself grant a higher coordinate_accuracy tier;
    resolve_coordinate_accuracy() still separately requires ward/place-name
    text agreement or multi-variant coordinate convergence for 'ward'/'exact'."""
    if not expected_region_text:
        return True
    expected = ascii_key(expected_region_text)
    if not expected:
        return True

    expected_variants = {expected}
    for group in _REGION_NOTATION_VARIANTS:
        if expected in group:
            expected_variants |= group
    # 병합표는 표기 그대로의 이름(예: "Hồ Chí Minh")을 키로 갖고 있으므로, 위
    # 표기 변형 확장(예: "TP.HCM" -> "Hồ Chí Minh" 포함) 이후의 모든 변형 각각에
    # 대해 병합 그룹을 조회해야 한다 — expected_region_text 원문 하나만 조회하면
    # "TP.HCM"처럼 병합표에 직접 없는 표기가 자기 그룹(Bình Dương 등)을 못 찾는다.
    for variant in list(expected_variants):
        expected_variants |= merged_province_group(variant)

    all_segments: list[str] = []
    for field_key in ("state", "county", "city", "formatted", "address_line2"):
        all_segments.extend(_region_segments(top.get(field_key)))

    return any(v == seg or v in seg for v in expected_variants for seg in all_segments)


def _geocode_query_raw(
    query_text_for_cache: str,
    query: str,
    bias_province: str | None = None,
    bbox_rect: tuple[float, float, float, float] | None = None,
) -> dict:
    """Low-level single-query primitive shared by geocode_address() (single-
    shot, confidence+region-gated) and the multi-candidate cascade in
    resolve_coordinate_accuracy() (which needs the RAW top result — even a
    low-confidence or region-mismatched one — to score across several query
    variants itself, rather than have any one variant silently discarded
    before the cascade ever sees it).

    Returns {'status': 'success'|'no_results'|'api_error'|'no_api_key'|'empty_query',
    'lat','lng','top': dict|None}. Only 'status'=='success' has non-None top.
    Caches successes/no_results (not api_error — see geocode_address's docstring
    for why a transient failure must never look like a confirmed "bad address").

    bbox_rect: (lon1, lat1, lon2, lat2) — a HARD rect filter (excludes results
    outside it), distinct from bias_province's soft proximity nudge. Used by
    the cascade's dedicated 'bbox' query variant only.
    """
    if not query or not query.strip():
        return {"status": "empty_query", "lat": None, "lng": None, "top": None}
    if not GEOAPIFY_API_KEY:
        logger.warning("GEOAPIFY_API_KEY 없음 — geocoding 스킵: %s", query)
        return {"status": "no_api_key", "lat": None, "lng": None, "top": None}

    cached = _read_cache(query_text_for_cache)
    if cached and cached.get("status") in ("success", "no_results"):
        logger.info("geocode_cache 적중: %s", query)
        return {"status": cached["status"], "lat": cached.get("lat"), "lng": cached.get("lng"),
                "top": cached.get("raw_response") if cached["status"] == "success" else None}

    params = {"text": query, "filter": "countrycode:vn", "format": "json", "limit": 1, "apiKey": GEOAPIFY_API_KEY}
    if bbox_rect:
        lon1, lat1, lon2, lat2 = bbox_rect
        params["filter"] = f"rect:{lon1},{lat1},{lon2},{lat2}"
    elif bias_province:
        center = REGION_BIAS_CENTERS.get(bias_province)
        if center:
            lat_c, lng_c = center
            params["bias"] = f"proximity:{lng_c},{lat_c}"

    try:
        resp = httpx.get(GEOAPIFY_GEOCODE_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Geoapify geocoding 요청 실패 (%s): %s", query, exc)
        return {"status": "api_error", "lat": None, "lng": None, "top": None}

    results = data.get("results") or []
    if not results:
        _write_cache(query_text_for_cache, None, None, "geoapify", data, "no_results")
        return {"status": "no_results", "lat": None, "lng": None, "top": None}

    top = results[0]
    lat, lng = top.get("lat"), top.get("lon")
    if lat is None or lng is None:
        _write_cache(query_text_for_cache, None, None, "geoapify", top, "no_results")
        return {"status": "no_results", "lat": None, "lng": None, "top": None}

    _write_cache(query_text_for_cache, lat, lng, "geoapify", top, "success")
    return {"status": "success", "lat": lat, "lng": lng, "top": top}


def geocode_address(
    raw_address: str,
    region_hint: str = "Vietnam",
    expected_region_text: str | None = None,
    bias_province: str | None = None,
) -> dict:
    """Single-shot geocode with confidence + region-text gating baked in —
    kept for simple single-query callers. The multi-candidate cascade (see
    resolve_coordinate_accuracy) uses _geocode_query_raw() directly instead,
    since it needs to see and score every variant's raw result itself rather
    than have any one of them silently rejected here first.

    Always returns a dict (never bare None) with a 'status' field so callers
    can tell "this candidate is genuinely a bad/ambiguous address" apart from
    "the API call itself failed" — the two must be handled differently
    upstream (a transient API failure must never be treated as confirmed
    evidence that an address doesn't check out, e.g. used to wipe existing
    job_work_locations rows).

    status values: 'success' | 'empty_query' | 'no_api_key' | 'api_error'
    | 'no_results' | 'low_confidence' | 'region_mismatch'.
    Only 'success' carries usable lat/lng; every other status has lat=lng=None.

    expected_region_text: the province/city text the caller already believes
    this candidate belongs to (e.g. the "Bình Dương:" prefix vieclam24h puts
    on each 'Địa điểm làm việc' line). When given, a result whose returned
    region text doesn't contain it is rejected as 'region_mismatch' even at
    high confidence — confidence alone only means "the text matched
    something", not "the right something" (observed directly: a Tân Phú,
    TP.HCM address matched Bình Dương at confidence 0.9).

    bias_province: a REGION_BIAS_CENTERS key (see resolve_bias_province()) —
    soft-biases Geoapify's ranking toward that province's coordinates. Not
    a hard filter (a province-spanning address far from the nominal center
    still comes back), but confirmed empirically to matter a great deal:
    without it, confidence for real addresses across several provinces came
    back at 0-0.45 (below MIN_CONFIDENCE), some resolving to entirely the
    wrong province. Pass resolve_bias_province(region_prefix) from the
    caller's split_work_locations(..., with_region=True) output.
    """
    if not raw_address or not raw_address.strip():
        return {"lat": None, "lng": None, "source": "geoapify", "status": "empty_query", "raw_response": {}}

    query = f"{raw_address}, {region_hint}" if region_hint else raw_address
    query_text = _cache_key(raw_address, f"{region_hint}|{bias_province or ''}", expected_region_text)
    raw = _geocode_query_raw(query_text, query, bias_province=bias_province)

    if raw["status"] != "success":
        return {"lat": None, "lng": None, "source": "geoapify", "status": raw["status"], "raw_response": raw.get("top") or {}}

    top = raw["top"]
    confidence = (top.get("rank") or {}).get("confidence")
    if confidence is not None and confidence < MIN_CONFIDENCE:
        logger.warning(
            "낮은 신뢰도로 스킵 (confidence=%.3f < %.2f): %s", confidence, MIN_CONFIDENCE, raw_address
        )
        _write_cache(query_text, None, None, "geoapify", top, "low_confidence")
        return {"lat": None, "lng": None, "source": "geoapify", "status": "low_confidence", "raw_response": top}

    if not _region_text_matches(top, expected_region_text):
        logger.warning(
            "행정구역 불일치로 스킵 (기대 지역=%s, 반환 state/county/city=%s/%s/%s, confidence=%s): %s",
            expected_region_text, top.get("state"), top.get("county"), top.get("city"), confidence, raw_address,
        )
        _write_cache(query_text, None, None, "geoapify", top, "region_mismatch")
        return {"lat": None, "lng": None, "source": "geoapify", "status": "region_mismatch", "raw_response": top}

    return {"lat": raw["lat"], "lng": raw["lng"], "source": "geoapify", "status": "success", "raw_response": top}


# ══════════════════════════════════════════════════════════════════════════
# Multi-candidate query cascade + coordinate-accuracy scoring.
#
# address_accuracy (from job_quality.classify_work_location_candidate) says
# whether the raw TEXT itself is a real, specific address — completely
# separate from coordinate_accuracy here, which says how much we trust a
# *map pin* for it. A job can have real address text and still get NO
# reliable pin (coordinate_accuracy='unresolved') — the text is still shown,
# just without a fabricated-looking marker. This split exists because a
# single-query confidence score alone turned out to reject most real
# addresses (empirically: 9/10 real vieclam24h addresses scored <0.5
# confidence on a single plain-text query, including several that WERE
# genuinely findable through a differently-phrased query).
# ══════════════════════════════════════════════════════════════════════════

_CU_ANNOTATION_RE = re.compile(r"\([^)]*cũ[^)]*\)\.?", re.IGNORECASE)
_PLACE_NAME_RE = re.compile(r"\b(KCN|CCN|Khu Công Nghiệp|Cụm Công Nghiệp|Tòa nhà|Lô)\s+[^,]+", re.IGNORECASE)
_CENTROID_RESULT_TYPES = {"country", "state", "county", "city"}
_WARD_CLUSTER_RADIUS_KM = 0.3  # "converge" threshold for both the exact-tier and ward-tier coordinate clusters.

# Coarse Vietnam bounding box — a final sanity net independent of Geoapify's
# own confidence score, in case a geocode ever comes back for the right text
# but the wrong country/hemisphere entirely. Same values as crawl_topcv.py's
# copy (kept separate rather than a shared import to avoid a circular
# dependency between the two modules — this is a static constant, not logic).
_VN_LAT_RANGE = (8.0, 24.0)
_VN_LNG_RANGE = (102.0, 110.0)


def normalize_address_for_query(raw_address: str) -> str:
    """Strategy 3: strip '(cũ)'-style former-name annotations and collapse
    consecutive duplicate comma-segments (e.g. a province name repeated
    verbatim under both its old and new administrative label)."""
    text = normalize_whitespace(_CU_ANNOTATION_RE.sub(" ", str(raw_address or "")))
    seen: set[str] = set()
    deduped: list[str] = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        key = ascii_key(part)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(part)
    return ", ".join(deduped)


def extract_place_name(raw_address: str) -> str | None:
    """The 'KCN X' / 'Lô Y' / 'Tòa nhà Z' portion of an address, if any —
    strategy 5's dedicated place-name-only query, and also used to require
    'is this specific place actually confirmed' for the exact tier."""
    m = _PLACE_NAME_RE.search(str(raw_address or ""))
    return m.group(0).strip() if m else None


_LEADING_HOUSE_NUMBER_RE = re.compile(r"^\d+[A-Za-z]?(?:/\d+[A-Za-z]?)*\s+")


def extract_core_identifier(raw_address: str) -> str | None:
    """The specific-place text the 'exact' tier must confirm before trusting
    a coordinate — extract_place_name()'s KCN/Lô/Tòa nhà result when there is
    one, otherwise the address's own first comma-segment with any leading
    house/lot number stripped (e.g. "45 Trần Mai Ninh" -> "Trần Mai Ninh",
    "98/3D Bình Đường 3" -> "Bình Đường 3") — a plain street address still
    names a specific, checkable street, it just isn't a named building/park.

    Added after a real false 'exact' (2026-09-04, C1 전수검증 중 발견): two
    low-confidence (0.06~0.08) Geoapify variants for "98/3D Bình Đường 3,
    phường Dĩ An, ..." both fuzzy-matched a completely unrelated street
    ("Đường Hòa Bình" — similar characters, different place, ~15km away in
    Bình Thới) and happened to land on the identical coordinate, which was
    enough to pass the exact tier's "2+ variants converge" check on
    coordinates alone — nothing was checking that the STREET NAME in the
    result had anything to do with the street actually queried. Before this,
    that confirmation only ever ran for named buildings/parks (place_name),
    since ordinary street addresses had no candidate text to check at all."""
    place_name = extract_place_name(raw_address)
    if place_name:
        return place_name
    first_segment = str(raw_address or "").split(",", 1)[0].strip()
    core = _LEADING_HOUSE_NUMBER_RE.sub("", first_segment).strip()
    return core or None


def build_query_variants(raw_address: str, province: str | None) -> list[dict]:
    """Strategies 2-6 (1 — a Google Maps link/coordinate embedded in the
    source text — is handled separately by the caller before this is ever
    invoked, since it needs the full job detail text, not just one address
    candidate). Each variant is {'type': str, 'query': str, 'bbox_province':
    str|None} — 'bbox_province' marks the one variant that should use a hard
    bounding-box filter (see resolve_bias_province) instead of soft bias."""
    province_suffix = f"{province}, Vietnam" if province else "Vietnam"
    variants: list[dict] = [{"type": "raw", "query": f"{raw_address}, {province_suffix}"}]

    normalized = normalize_address_for_query(raw_address)
    if ascii_key(normalized) != ascii_key(raw_address):
        variants.append({"type": "normalized", "query": f"{normalized}, {province_suffix}"})

    parts = [p.strip() for p in str(raw_address or "").split(",") if p.strip()]
    if parts:
        core = parts[0]
        district = parts[-1] if len(parts) > 1 else None
        if district and (not province or ascii_key(district) != ascii_key(province)):
            variants.append({"type": "structured", "query": f"{core}, {district}, {province_suffix}"})

    place_name = extract_place_name(raw_address)
    if place_name:
        variants.append({"type": "place_name_only", "query": f"{place_name}, {province_suffix}"})

    bias_province = resolve_bias_province(province) if province else None
    if bias_province:
        variants.append({"type": "bbox", "query": f"{raw_address}, {province_suffix}", "bbox_province": bias_province})

    return variants


def _place_name_matches(top: dict, place_name: str | None) -> bool | None:
    if not place_name:
        return None
    expected = ascii_key(place_name)
    haystack = ascii_key(" ".join(str(top.get(k) or "") for k in ("name", "address_line1", "formatted", "street")))
    return expected in haystack


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat, d_lng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))


def _largest_cluster_within_km(points: list[dict], radius_km: float) -> list[dict]:
    """points: [{'lat','lng',...}]. Returns the largest subset that are all
    mutually within radius_km of at least one shared anchor point."""
    best: list[dict] = []
    for anchor in points:
        cluster = [p for p in points if _haversine_km(anchor["lat"], anchor["lng"], p["lat"], p["lng"]) <= radius_km]
        if len(cluster) > len(best):
            best = cluster
    return best


def resolve_coordinate_accuracy(raw_address: str, province: str | None) -> dict:
    """Runs the full query cascade for one address candidate and scores the
    results using several signals together (country/province/district/place-
    name agreement, result_type "is this a real feature or just a region
    centroid", and — critically — whether 2+ INDEPENDENT query variants agree),
    instead of a single query's confidence score.

    Returns {'coordinate_accuracy': 'exact'|'ward'|'region'|'unresolved',
    'lat': float|None, 'lng': float|None, 'geocode_source': str|None,
    'evidence': str, 'had_transient_failure': bool}.

    Tier rules (see crawler/test_address_pipeline_integration.py for the
    worked real-address examples that motivated each one):
    - A "conflicting" address (2+ variants land in non-centroid results, and
      at least one of them is confidently in a DIFFERENT province than
      expected) is never trusted at any tier above 'unresolved' — a single
      correct-looking hit does not outweigh evidence the address is
      ambiguous/collides with an unrelated same-named place elsewhere.
    - 'exact': 2+ distinct query variants converge (<=300m) on a non-centroid,
      province-confirmed point, AND the core identifier (extract_core_identifier
      — a named building/park if the address has one, otherwise the address's
      own street name) is confirmed by at least one of them. Coordinate
      convergence alone is never enough: two low-confidence variants can both
      fuzzy-match a completely different, unrelated street and still land on
      the same wrong point (confirmed live — see extract_core_identifier's
      docstring) — this check is what would catch that.
    - 'ward': either (a) 2+ variants converge <=300m on a non-centroid,
      province-confirmed point but the core identifier is NOT confirmed there
      (we're confident about the location, not that it's exactly the named
      site), or (b) 2+ DISTINCT non-centroid, province-confirmed results
      (not necessarily close together) agree on the same district/ward text
      (county or city field) — covers real cases where a district genuinely
      spans several km and independent queries land on different real
      buildings within it.
    - 'region': no ward/exact evidence, but at least one result (centroid or
      not) confirms the expected province with no conflicting result.
    - 'unresolved': anything else — no usable result, or conflicting
      provinces.
    """
    place_name = extract_core_identifier(raw_address)
    variants = build_query_variants(raw_address, province)

    valid: list[dict] = []  # successfully-geocoded, in-Vietnam results
    had_transient_failure = False
    for v in variants:
        query_text_for_cache = _cache_key(raw_address, f"cascade|{v['type']}|{province or ''}", None)
        bbox_province = v.get("bbox_province")
        raw = _geocode_query_raw(
            query_text_for_cache, v["query"],
            bias_province=None if bbox_province else (resolve_bias_province(province) if province else None),
            bbox_rect=_bbox_for_province(bbox_province) if bbox_province else None,
        )
        if raw["status"] == "api_error":
            had_transient_failure = True
            continue
        if raw["status"] != "success":
            continue
        lat, lng = raw["lat"], raw["lng"]
        if not (_VN_LAT_RANGE[0] <= lat <= _VN_LAT_RANGE[1] and _VN_LNG_RANGE[0] <= lng <= _VN_LNG_RANGE[1]):
            continue
        top = raw["top"]
        valid.append({
            "variant": v["type"], "lat": lat, "lng": lng, "top": top,
            "is_centroid": top.get("result_type") in _CENTROID_RESULT_TYPES,
            "province_ok": _region_text_matches(top, province),
            "place_ok": _place_name_matches(top, place_name),
        })

    non_centroid = [p for p in valid if not p["is_centroid"]]
    non_centroid_ok = [p for p in non_centroid if p["province_ok"]]

    # 실측 발견(2026-09-04, 실제 공고 100건 주소 품질 조사 중): Geoapify가 같은
    # 실제 장소(좌표까지 동일)를 두고도 질의 문구에 따라 state/county 필드를
    # 통째로 비워서 반환하는 경우가 있다(예: "(cũ)" 주석을 뺀 normalized 변형만
    # county가 비어 있고 나머지 raw/structured/bbox 3개 변형은 전부 채워져
    # 있는데도 넷 다 좌표가 완전히 동일). 이 경우 그 변형 하나만으로
    # province_ok=False가 되어 곧바로 "다른 행정구역과 충돌"로 판정되고, 이미
    # 3개 변형이 정확히 일치하는 정상 주소까지 전부 unresolved로 거부되는
    # 결함이 있었다(실사례: "OfficeHaus, 32 Tân Thắng..." — 4개 변형 중 3개가
    # 동일 좌표(10.7999786, 106.6147282)에서 state="Ho Chi Minh"으로 정확히
    # 일치했지만, county가 비어 있던 1개 변형 때문에 전체가 unresolved 처리됨).
    # province_ok=False인 결과라도 이미 확인된(province_ok=True) 결과와 좌표가
    # 사실상 같은 지점(<=300m, exact-tier 수렴 기준과 동일)이면 "같은 곳인데
    # 메타데이터만 부실한 응답"으로 보고 충돌 판정에서 제외한다 — 진짜 다른
    # 지역의 동명 장소(예: Lâm Đồng 오탐)는 좌표 자체가 멀리 떨어져 있으므로
    # 이 예외에 해당하지 않아 여전히 충돌로 잡힌다.
    def _has_nearby_confirmed_match(p: dict) -> bool:
        return any(
            _haversine_km(p["lat"], p["lng"], q["lat"], q["lng"]) <= _WARD_CLUSTER_RADIUS_KM
            for q in non_centroid_ok
        )

    conflicting = any(
        not p["province_ok"] and not _has_nearby_confirmed_match(p)
        for p in non_centroid
    )
    conflict_reason = "a non-centroid result in a different province was found" if conflicting else ""

    # "Outvoted" check: a province-name text match can be a same-name
    # coincidence with an unrelated place far away (confirmed live — e.g. a
    # "Thuận An" commune 300+km from the real Thuận An, Bình Dương; a "Hưng
    # Yên" commune inside Đồng Nai province, unrelated to Hưng Yên province).
    # _region_text_matches can't tell these apart from text alone. If a
    # FAR-AWAY (>10km) cluster of province-matching results outnumbers (by
    # distinct variant count) the best nearby non-centroid cluster, the
    # nearby signal is not trustworthy enough even for 'region' — 2 results
    # confidently pointing at the wrong place beats 1 pointing at the right
    # one, when there's no way here to tell which is which except by count.
    def _unit_of(p: dict) -> str:
        return ascii_key(p["top"].get("county") or p["top"].get("city") or "")

    province_ok_all = [p for p in valid if p["province_ok"]]
    if non_centroid_ok and province_ok_all:
        anchor = non_centroid_ok[0]
        anchor_unit = _unit_of(anchor)
        near_cluster = [p for p in province_ok_all if _haversine_km(anchor["lat"], anchor["lng"], p["lat"], p["lng"]) <= 10]
        near_votes = len({p["variant"] for p in near_cluster})
        # A result that names the SAME district/ward text as the anchor is
        # not a "conflict" ONLY when it's also within a plausible distance
        # (<=50km, matching the ward-tier admin-unit path's own coherence
        # radius below) — that's the scattered-but-genuinely-same-place
        # pattern the ward tier is meant to accept. A same-NAME result
        # hundreds of km away is a same-name-coincidence (confirmed live: a
        # "Thuận An" 300+km from the real Thuận An, Bình Dương) and must
        # still count as a competing candidate despite the matching text.
        far = [
            p for p in province_ok_all
            if p not in near_cluster
            and not (anchor_unit and _unit_of(p) == anchor_unit and _haversine_km(anchor["lat"], anchor["lng"], p["lat"], p["lng"]) <= 50)
        ]
        if far:
            far_clusters: dict[int, list[dict]] = {}
            for p in far:
                placed = False
                for key, members in far_clusters.items():
                    if _haversine_km(members[0]["lat"], members[0]["lng"], p["lat"], p["lng"]) <= 10:
                        members.append(p)
                        placed = True
                        break
                if not placed:
                    far_clusters[len(far_clusters)] = [p]
            max_far_votes = max((len({p["variant"] for p in g}) for g in far_clusters.values()), default=0)
            # >= (not just >): a tie is still disqualifying — 1 far-away
            # candidate contradicting 1 near candidate is exactly as
            # unresolvable as "unrelated place with the same name" as a
            # 2-vs-1 split; nothing here can tell us which one is real.
            if max_far_votes >= near_votes:
                conflicting = True
                conflict_reason = (
                    f"a farther-away, same-province-text result was confirmed by at least as many "
                    f"independent variants ({max_far_votes}) as the nearer candidate ({near_votes}) — likely a "
                    f"same-name-coincidence with an unrelated place, not trustworthy at any tier"
                )

    def _geocoded_region_text(top: dict | None) -> str | None:
        if not top:
            return None
        return top.get("state") or top.get("county") or top.get("city") or None

    def _region_breakdown_note(sample: dict | None) -> str:
        """원문 지역(province), 지오코더가 실제로 반환한 지역, 2025 통합표 기준
        현재 표준화된 지역을 evidence에 각각 기록한다 — 사용자 지시: "동일
        행정권역으로 인정된다고 해서 자동으로 exact 좌표가 되는 것은 아니"므로,
        이 표기는 근거 기록용일 뿐 등급 판정 자체에는 관여하지 않는다."""
        if not province:
            return ""
        geocoded = _geocoded_region_text(sample["top"]) if sample else None
        normalized = canonical_province_name_2025(province) or province
        return f" [raw_region={province}; geocoded_region={geocoded or '(none)'}; normalized_region={normalized}]"

    def _result(tier: str, point: dict | None, evidence: str) -> dict:
        sample = point or (non_centroid_ok[0] if non_centroid_ok else (valid[0] if valid else None))
        return {
            "coordinate_accuracy": tier,
            "lat": point["lat"] if point else None,
            "lng": point["lng"] if point else None,
            "geocode_source": "geoapify" if point else None,
            "evidence": f"{evidence}{_region_breakdown_note(sample)}",
            "had_transient_failure": had_transient_failure,
        }

    if conflicting:
        return _result("unresolved", None, f"{conflict_reason} — too ambiguous to trust any tier")

    if len(non_centroid_ok) >= 2:
        cluster = _largest_cluster_within_km(non_centroid_ok, _WARD_CLUSTER_RADIUS_KM)
        cluster_variants = {p["variant"] for p in cluster}
        if len(cluster_variants) >= 2:
            place_supported = place_name is None or any(p["place_ok"] for p in cluster)
            if place_supported:
                return _result("exact", cluster[0], f"{len(cluster_variants)} variants converged <=300m, province+place confirmed")
            return _result("ward", cluster[0], f"{len(cluster_variants)} variants converged <=300m, but named place not confirmed")

    # No tight non-centroid coordinate cluster (or fewer than 2 non-centroid
    # results at all) — try district/ward TEXT agreement instead. A centroid
    # result's city/county field IS a meaningful ward/commune-level signal
    # (that's its actual precision level) even though it can't anchor an
    # 'exact' claim, so centroid results are included here too — unlike the
    # exact-tier cluster above. To avoid this reintroducing the same-name-
    # different-place problem the 'conflicting' check exists for, a group
    # only counts if its members are ALSO mutually within 50km (a district
    # can legitimately span several km; a same-named place on the other
    # side of the country cannot) — the far-away 230A/2-style case is
    # already excluded earlier by the outvoted/conflicting check, this is a
    # second, independent guard against a same-named district appearing in
    # a completely different, unrelated province.
    def _units_match(a: str, b: str) -> bool:
        return bool(a) and bool(b) and (a == b or a in b or b in a)

    province_key = ascii_key(province) if province else ""
    unit_groups: list[list[dict]] = []
    for p in province_ok_all:
        unit = _unit_of(p)
        # A unit that just restates the province name (e.g. city="Cần Thơ"
        # when the expected province IS "Cần Thơ" — confirmed live: this
        # happens for centroid results whose 'city' field is really the
        # province-level city) carries no ward-level information beyond
        # what the 'region' tier already knows — skip it here rather than
        # let it masquerade as district-level corroboration.
        if not unit or (province_key and unit == province_key):
            continue
        placed = False
        for group in unit_groups:
            if _units_match(unit, _unit_of(group[0])) and _haversine_km(group[0]["lat"], group[0]["lng"], p["lat"], p["lng"]) <= 50:
                group.append(p)
                placed = True
                break
        if not placed:
            unit_groups.append([p])
    best_unit_group = max(unit_groups, key=lambda g: len({p["variant"] for p in g}), default=[])
    if len({p["variant"] for p in best_unit_group}) >= 2:
        representative = next((p for p in best_unit_group if not p["is_centroid"]), best_unit_group[0])
        return _result(
            "ward", representative,
            f"{len({p['variant'] for p in best_unit_group})} distinct variants agree on the same district/ward within 50km, coordinates not tightly clustered",
        )

    if any(p["province_ok"] for p in valid):
        return _result("region", None, "province confirmed by at least one result, no ward/exact-level corroboration")

    return _result("unresolved", None, "no result confirmed the expected province")

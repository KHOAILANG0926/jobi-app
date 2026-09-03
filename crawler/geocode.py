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
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

from job_quality import PROVINCE_COORDS, ascii_key, guess_province_from_text

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

# Vietnam's 2025 administrative merger folded these Bình Dương districts
# into Hồ Chí Minh. This is evidenced directly in this project's own scraped
# data — job 4366's real "Địa điểm làm việc" text literally labels itself
# "Bình Dương (cũ)." ("Bình Dương, former") for exactly these districts.
# Deliberately narrow and ONE-DIRECTIONAL (only widens an expected "Bình
# Dương" to also accept these districts under a "Hồ Chí Minh" result) rather
# than a blanket Bình Dương<->Hồ Chí Minh province alias: a blanket alias
# was tried first and rejected because it would also swallow the exact bug
# this whole check exists to catch — a Tân Phú (a TP.HCM district, NOT one
# of these) address that Geoapify wrongly geocoded to Bình Dương at high
# confidence (see MIN_CONFIDENCE's docstring). Tân Phú must still be
# rejected when the expected region is "Hồ Chí Minh"/"TP.HCM" and Geoapify
# returns Bình Dương — only the reverse (expected "Bình Dương", one of
# THESE specific ex-districts returned under Hồ Chí Minh) is accepted.
_EX_BINH_DUONG_DISTRICTS = {
    "di an", "thuan an", "thu dau mot", "tan uyen", "ben cat",
    "dau tieng", "bau bang", "bac tan uyen", "phu giao",
}


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
    province name."""
    if not expected_region_text:
        return True
    expected = ascii_key(expected_region_text)
    if not expected:
        return True

    expected_variants = {expected}
    for group in _REGION_NOTATION_VARIANTS:
        if expected in group:
            expected_variants |= group

    all_segments: list[str] = []
    for field_key in ("state", "county", "city", "formatted", "address_line2"):
        all_segments.extend(_region_segments(top.get(field_key)))

    if any(v == seg or v in seg for v in expected_variants for seg in all_segments):
        return True

    if expected == "binh duong":
        district_segments = _region_segments(top.get("county")) + _region_segments(top.get("city"))
        if any(d in seg for d in _EX_BINH_DUONG_DISTRICTS for seg in district_segments):
            return True

    return False


def geocode_address(
    raw_address: str,
    region_hint: str = "Vietnam",
    expected_region_text: str | None = None,
    bias_province: str | None = None,
) -> dict:
    """Always returns a dict (never bare None) with a 'status' field so callers
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
    if not GEOAPIFY_API_KEY:
        logger.warning("GEOAPIFY_API_KEY 없음 — geocoding 스킵: %s", raw_address)
        return {"lat": None, "lng": None, "source": "geoapify", "status": "no_api_key", "raw_response": {}}

    query_text = _cache_key(raw_address, f"{region_hint}|{bias_province or ''}", expected_region_text)
    cached = _read_cache(query_text)
    if cached:
        logger.info("geocode_cache 적중: %s", raw_address)
        return cached

    query = f"{raw_address}, {region_hint}" if region_hint else raw_address
    params = {
        "text": query,
        "filter": "countrycode:vn",
        "format": "json",
        "limit": 1,
        "apiKey": GEOAPIFY_API_KEY,
    }
    center = REGION_BIAS_CENTERS.get(bias_province) if bias_province else None
    if center:
        lat_c, lng_c = center
        params["bias"] = f"proximity:{lng_c},{lat_c}"

    try:
        resp = httpx.get(GEOAPIFY_GEOCODE_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        # Transient failure (network/API) — deliberately NOT cached and NOT
        # treated as "this address is bad". Caller must not use this as
        # grounds to delete/replace previously-known-good data.
        logger.warning("Geoapify geocoding 요청 실패 (%s): %s", raw_address, exc)
        return {"lat": None, "lng": None, "source": "geoapify", "status": "api_error", "raw_response": {}}

    results = data.get("results") or []
    if not results:
        logger.warning("Geoapify 결과 없음: %s", raw_address)
        result = {"lat": None, "lng": None, "source": "geoapify", "status": "no_results", "raw_response": data}
        _write_cache(query_text, None, None, "geoapify", data, "no_results")
        return result

    top = results[0]
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

    lat, lng = top.get("lat"), top.get("lon")
    if lat is None or lng is None:
        return {"lat": None, "lng": None, "source": "geoapify", "status": "no_results", "raw_response": top}

    _write_cache(query_text, lat, lng, "geoapify", top, "success")
    return {"lat": lat, "lng": lng, "source": "geoapify", "status": "success", "raw_response": top}

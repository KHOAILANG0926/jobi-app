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

from job_quality import ascii_key

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "")
GEOAPIFY_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
_supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Same coordinate as src/lib/jobCoords.ts's PLACES entry for Hồ Chí Minh City —
# keep these two in sync by hand if it ever moves there; there's no shared
# config between the TS frontend and this Python crawler to auto-derive it
# from. Only region_hint values with an entry here get the extra `filter=
# circle:...` restriction; anything else still gets the plain country filter.
REGION_BIAS_CENTERS: dict[str, tuple[float, float]] = {
    "Ho Chi Minh City": (10.7769, 106.7009),
}

# Geoapify's own docs: confidence >=0.95 is a confirmed match, <0.2 should be
# rejected outright, and 0.2–0.95 is a "needs further checking" band. A wrong-
# province match we saw directly (Bình Dương instead of Tân Phú) still scored
# 0.9 confidence — high confidence only means "the text matched something",
# not "the right something" — so this threshold is a deliberately conservative
# cut inside that gray band, meant to work together with the circle filter
# above (not replace it).
MIN_CONFIDENCE = 0.5


def _cache_key(raw_address: str, region_hint: str, expected_iso3166_2: str | None) -> str:
    """geocode_cache.query_text로 쓰는 안정적인 dedup 키. region_hint/
    expected_iso3166_2가 결과(채택 여부)에 영향을 주므로 캐시 키에도 포함한다
    — 안 그러면 같은 주소를 다른 조건으로 다시 geocode할 때 엉뚱한 캐시를
    재사용하게 된다. 실제 API에는 원문 raw_address를 그대로 보낸다(정확도용)
    — 이건 캐시 매칭 전용."""
    return ascii_key(f"{raw_address}|{region_hint}|{expected_iso3166_2 or ''}")


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
        if not rows or rows[0].get("lat") is None or rows[0].get("lng") is None:
            return None
        row = rows[0]
        return {
            "lat": row["lat"], "lng": row["lng"],
            "source": row.get("source") or "geoapify",
            "raw_response": row.get("raw_response") or {},
        }
    except Exception as exc:
        logger.warning("geocode_cache 조회 실패: %s", exc)
        return None


def _write_cache(query_text: str, lat, lng, source: str, raw_response: dict) -> None:
    if not _supabase:
        return
    try:
        _supabase.table("geocode_cache").upsert(
            {"query_text": query_text, "lat": lat, "lng": lng, "source": source, "raw_response": raw_response},
            on_conflict="query_text",
        ).execute()
    except Exception as exc:
        logger.warning("geocode_cache 저장 실패: %s", exc)


def geocode_address(
    raw_address: str,
    region_hint: str = "Vietnam",
    expected_iso3166_2: str | None = None,
) -> dict | None:
    """expected_iso3166_2: 호출부가 이미 알고 있는 예상 성/시 ISO 코드(예: 호치민시=
    "VN-SG"). 지정하면, Geoapify가 반환한 iso3166_2가 이 값과 다를 때 confidence가
    임계값을 넘어도 결과를 버린다 — "Bình Dương의 Tân Thắng"처럼 confidence만으로는
    안 걸러지는 완전히 다른 행정구역 매칭을 잡기 위함(실제로 관찰된 사례)."""
    if not raw_address or not raw_address.strip():
        return None
    if not GEOAPIFY_API_KEY:
        logger.warning("GEOAPIFY_API_KEY 없음 — geocoding 스킵: %s", raw_address)
        return None

    query_text = _cache_key(raw_address, region_hint, expected_iso3166_2)
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
    center = REGION_BIAS_CENTERS.get(region_hint)
    if center:
        lat_c, lng_c = center
        # circle filter already implies "inside Vietnam" — replaces the plain
        # country filter with a tighter 30km restriction around the region.
        params["filter"] = f"circle:{lng_c},{lat_c},30000"

    try:
        resp = httpx.get(GEOAPIFY_GEOCODE_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Geoapify geocoding 요청 실패 (%s): %s", raw_address, exc)
        return None

    results = data.get("results") or []
    if not results:
        logger.warning("Geoapify 결과 없음: %s", raw_address)
        _write_cache(query_text, None, None, "geoapify", data)
        return None

    top = results[0]
    confidence = (top.get("rank") or {}).get("confidence")
    if confidence is not None and confidence < MIN_CONFIDENCE:
        logger.warning(
            "낮은 신뢰도로 스킵 (confidence=%.3f < %.2f): %s", confidence, MIN_CONFIDENCE, raw_address
        )
        _write_cache(query_text, None, None, "geoapify", top)
        return None

    if expected_iso3166_2 is not None:
        actual_iso = top.get("iso3166_2")
        if actual_iso != expected_iso3166_2:
            logger.warning(
                "행정구역 불일치로 스킵 (iso3166_2=%s, 기대값=%s, confidence=%s): %s",
                actual_iso, expected_iso3166_2, confidence, raw_address,
            )
            _write_cache(query_text, None, None, "geoapify", top)
            return None

    lat, lng = top.get("lat"), top.get("lon")
    if lat is None or lng is None:
        return None

    _write_cache(query_text, lat, lng, "geoapify", top)
    return {"lat": lat, "lng": lng, "source": "geoapify", "raw_response": top}

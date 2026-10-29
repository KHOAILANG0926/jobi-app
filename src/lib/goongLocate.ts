// Goong(두 번째 지도 자료) 결과를 우리 판정 규칙에 맞는 모양으로 바꾼다 — Lee 2026-10-29 "바꾸고 앱에 올려".
// 판정 기준은 VietMap과 같다: ① 번지 — 번지·도로명이 결과에 그대로 있고 원문 동/구와 맞을 때만,
// ② 회사+공단 — 회사명이 정확히 같은 곳이 1곳이고 그 점이 공단 경계(OpenStreetMap 면) 안일 때만.
// 조건을 못 채우면 핀으로 쓰지 않는다(다음 단계로 내려감). 키·주소·응답 본문은 로그에 쓰지 않는다.
import { INDUSTRIAL_PARK_OUTLINES } from '../data/industrialParkOutlines'
import { isExactCompanyName, pointInRing } from './locationCandidateMatch'
type IndustrialPark = NonNullable<ReturnType<typeof import('./industrialPark').findIndustrialPark>>

export interface GoongAddressHit { ref_id: string; name: string; address: string; display: string; lat: number; lng: number;
  units: { ward: string; district: string; province: string } }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)

/** Geocode 응답 → 주소 후보(번지 판정 함수 pickAddressHit이 읽는 모양). */
export function goongAddressHits(json: unknown): GoongAddressHit[] {
  const results = (json as { results?: unknown[] } | null)?.results
  return (Array.isArray(results) ? results : []).flatMap((r) => {
    const x = r as { place_id?: string; formatted_address?: string; name?: string; address?: string;
      geometry?: { location?: { lat?: number; lng?: number } }; compound?: { commune?: string; district?: string; province?: string } }
    const lat = num(x.geometry?.location?.lat), lng = num(x.geometry?.location?.lng)
    const formatted = String(x.formatted_address ?? '')
    if (!x.place_id || !formatted || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return [{ ref_id: String(x.place_id), name: String(x.name ?? formatted.split(',')[0] ?? ''), address: formatted, display: formatted, lat, lng,
      units: { ward: String(x.compound?.commune ?? ''), district: String(x.compound?.district ?? ''), province: String(x.compound?.province ?? '') } }]
  })
}

/** AutoComplete 응답 → 회사명이 정확히 같은 후보가 정확히 1곳일 때만 그 place_id. */
export function pickGoongCompany(company: string, json: unknown): { placeId: string | null; multiple: boolean } {
  const preds = (json as { predictions?: unknown[] } | null)?.predictions
  const exact = (Array.isArray(preds) ? preds : []).filter((p) => {
    const x = p as { place_id?: string; structured_formatting?: { main_text?: string } }
    return x.place_id && x.structured_formatting?.main_text && isExactCompanyName(company, x.structured_formatting.main_text)
  }) as { place_id: string }[]
  if (exact.length !== 1) return { placeId: null, multiple: exact.length > 1 }
  return { placeId: exact[0].place_id, multiple: false }
}

/** Place Detail 응답 → 좌표·이름·주소. */
export function goongPlace(json: unknown): { lat: number; lng: number; name: string; address: string } | null {
  const r = (json as { result?: { name?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } } } | null)?.result
  const lat = num(r?.geometry?.location?.lat), lng = num(r?.geometry?.location?.lng)
  if (!r || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, name: String(r.name ?? ''), address: String(r.formatted_address ?? '') }
}

/** 공단 경계(OSM 면) 안인가. 경계가 없는 공단은 판정하지 않는다(false). */
export function insideParkOutline(park: Pick<IndustrialPark, 'source'>, point: { lat: number; lng: number }): boolean {
  const outline = INDUSTRIAL_PARK_OUTLINES[park.source.ref]
  if (!outline) return false
  const [minLng, minLat, maxLng, maxLat] = outline.bounds
  if (point.lng < minLng || point.lng > maxLng || point.lat < minLat || point.lat > maxLat) return false
  return pointInRing(point.lat, point.lng, outline.ring)
}

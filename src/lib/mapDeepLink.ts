// 상세 → 홈 생활지도 바로가기 (2026-10-07). 홈 지도가 "이 위치·이 반경"으로 열리도록 주소에 값을 싣는다.
// 값은 읽을 때 반드시 검증한다(베트남 범위 밖 좌표·비정상 반경은 무시 → 홈 기본 화면).
import { normalizeSearchRadius } from './homeMapSearch'

export interface MapDeepLink { lat: number; lng: number; radiusKm: number; label: string }

const LAT = [8, 24] as const
const LNG = [102, 110] as const
const LABEL_MAX = 60

export function buildMapDeepLink({ lat, lng, radiusKm, label }: MapDeepLink): string {
  const q = new URLSearchParams({
    mapLat: lat.toFixed(5), mapLng: lng.toFixed(5), mapR: String(normalizeSearchRadius(radiusKm)), mapLabel: label.slice(0, LABEL_MAX),
  })
  return `/?${q.toString()}`
}

export function parseMapDeepLink(search: string): MapDeepLink | null {
  const p = new URLSearchParams(search)
  const lat = Number(p.get('mapLat')), lng = Number(p.get('mapLng')), r = Number(p.get('mapR'))
  if (!p.has('mapLat') || !p.has('mapLng') || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < LAT[0] || lat > LAT[1] || lng < LNG[0] || lng > LNG[1]) return null
  const label = (p.get('mapLabel') ?? '').replace(/[<>]/g, '').trim().slice(0, LABEL_MAX) || 'vị trí đã chọn'
  return { lat, lng, radiusKm: normalizeSearchRadius(Number.isFinite(r) && p.has('mapR') ? r : 3), label }
}

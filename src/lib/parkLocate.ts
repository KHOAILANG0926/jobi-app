// 공단 표(industrialParks)에 없는 공단의 대표 위치를 VietMap 공단 이름 검색으로 찾는다(2026-10-20, #4824 KCN Yên Phong 핀 없음).
// Lee 10-13 결정: 메인 지도에는 핀이 무조건 있어야 함. 10-14 핀 순서표: 번지 → 회사+공단 → 공단 입구 → 동 중심.
// 공단 이름이 정확히 같은 검색 결과가 그 성(省) 안에 한 곳뿐일 때만 쓴다("Yên Phong mở rộng"·"Yên Phong II"는 다른 공단).
// 결과는 대략 위치(kind 'area', 점선 핀)이며 길찾기 목적지로 쓰지 않는다.
import { normalizePlaceText } from './locationCandidateMatch'

const KCN_PREFIX = /^(?:khu cong nghiep|cum cong nghiep|khu che xuat|kcn|ccn|kcx)\s+/
const KCN_ANY = /(?:^|\s)(?:khu cong nghiep|cum cong nghiep|khu che xuat|kcn|ccn|kcx)\s+([a-z0-9 ]+)/
const PROVINCES = ['bac ninh', 'bac giang', 'ha noi', 'hai phong', 'hai duong', 'hung yen', 'thai nguyen', 'vinh phuc']

export interface ParkName { name: string; province: string | null; searchText: string }

/** 주소 글자에서 공단 이름(예: "yen phong")과 성을 뽑는다. 쉼표 앞까지가 공단 이름. */
export function parkNameFromAddresses(texts: Array<string | null | undefined>): ParkName | null {
  for (const raw of texts) {
    if (!raw) continue
    const segs = raw.split(',')
    for (const [i, seg] of segs.entries()) {
      const n = normalizePlaceText(seg)
      const m = n.match(KCN_ANY)
      if (!m) continue
      const name = m[1].trim()
      if (!name || name.length < 3) continue
      const all = normalizePlaceText(texts.filter(Boolean).join(' '))
      const province = PROVINCES.find((p) => all.includes(p)) ?? null
      const pretty = seg.trim().replace(/^(?:KCN|kcn|Kcn)\s+/, '')
      const rest = segs.slice(i + 1).map((x) => x.trim()).filter(Boolean)
      return { name, province, searchText: [`Khu công nghiệp ${pretty}`, ...rest].join(', ') }
    }
  }
  return null
}

interface Hit { ref_id?: string; name?: string; address?: string; display?: string; categories?: unknown[] }
/** 이름이 정확히 같은 공단 1곳만 고른다(성이 알려져 있으면 그 성 안). */
export function pickParkHit(park: ParkName, hits: unknown): { hit: Hit | null; multiple: boolean } {
  const list = (Array.isArray(hits) ? hits : []) as Hit[]
  const same = list.filter((h) => {
    if (!h.ref_id || !h.name) return false
    const n = normalizePlaceText(h.name).replace(KCN_PREFIX, '').trim()
    if (!KCN_PREFIX.test(normalizePlaceText(h.name))) return false
    if (n !== park.name) return false
    if (!park.province) return true
    return ` ${normalizePlaceText(`${h.address ?? ''} ${h.display ?? ''}`)} `.includes(` ${park.province} `)
  })
  if (same.length === 1) return { hit: same[0], multiple: false }
  // 같은 이름이 여럿이면 실제 장소(POI, 업종 분류가 있는 결과)가 한 곳뿐일 때 그곳을 쓴다.
  // 2026-10-20 실측: "Khu Công Nghiệp Yên Phong"이 Xã Yên Trung(분류 없음, 주소 결과)·Xã Yên Phong(분류 6005, 공단 POI) 두 개로 나옴.
  const poi = same.filter((h) => Array.isArray(h.categories) && h.categories.length > 0)
  if (poi.length === 1) return { hit: poi[0], multiple: false }
  return { hit: null, multiple: same.length > 1 }
}

/** Place 응답 확인: 좌표가 베트남 안이고, 성이 알려져 있으면 같은 성. */
export function parkPlaceOk(park: ParkName, place: { lat?: number; lng?: number; city?: string } | null): boolean {
  if (!place || typeof place.lat !== 'number' || typeof place.lng !== 'number') return false
  if (place.lat < 8 || place.lat > 24 || place.lng < 102 || place.lng > 110) return false
  if (park.province && place.city && !normalizePlaceText(place.city).includes(park.province)) return false
  return true
}

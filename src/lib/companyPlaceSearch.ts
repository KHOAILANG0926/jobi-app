// 회사 이름으로 지도 업체 찾기 — 추가 단계(Lee 2026-11-03 "비엣맵+궁 조합으로 안될 시 … 원인을 찾아서 업그레이드").
// 2026-11-03 비교(business-search-compare 41645439656): VietMap 0/11, Goong 3/11 — 원인
//   ① 공단 밖 공고는 회사 이름으로 아예 묻지 않음(번지 없으면 바로 대략 위치)
//   ② 이름 비교가 단어까지 똑같아야 함("JOY THÁI" ↔ "JoyThai - Thai Cuisine & Hotpot" 탈락)
//   ③ 같은 이름 지점이 여럿이면 거리로 좁히지 않고 포기
// 기존 단계(번지·회사+공단·공단 입구·동·성 대략 위치)는 그대로 두고, 공단 밖 공고에 이 단계를 더한다.
// 채택: 핵심 이름이 같은 후보 1곳(여럿이면 원문 거리 이름으로 좁혀 1곳) → 원래 성 경계 안인지는 resolver가 다시 본다.
// 결과는 '대략 위치(area)' — 화면은 chưa xác minh 그대로, 핀만 실제 업체 자리.
import { companyTokens, normalizePlaceText } from './locationCandidateMatch'

/** 이름 앞뒤 수식어를 뺀 핵심 이름(띄어쓰기 없이). "JoyThai - Thai Cuisine & Hotpot" → "joythai". */
export function coreName(name: string): string {
  const head = String(name ?? '').split(/\s[-–|]\s|[|(]/)[0] ?? ''
  const tokens = companyTokens(head).filter((t) => !CORE_IGNORED.has(t))
  return tokens.join('')
}
// 업종 일반어·지역 이름(이름의 '핵심'이 아님). 너무 많이 빼면 다른 회사와 같아지므로 짧게 둔다.
const CORE_IGNORED = new Set(['dich', 'vu', 'bao', 've', 'ninh', 'bac', 'giang', 'ha', 'noi', 'tp', 'thanh', 'pho', 'tinh', 'chi', 'nhanh', 'cn', 'co', 'so', 'nha', 'hang', 'quan', 'cua'])

/** 공고 회사 이름 ↔ 지도 업체 이름이 핵심 이름으로 같은가. 핵심 이름이 4글자보다 짧으면 판단하지 않는다(오탐 방지). */
export function sameCoreName(company: string, placeName: string): boolean {
  const a = coreName(company), b = coreName(placeName)
  if (a.length < 4 || b.length < 4) return false
  return a === b || (b.startsWith(a) && a.length >= 6) || (a.startsWith(b) && b.length >= 6)
}

/** 원문 주소의 거리 이름(번지·"đường/phố" 없이). 없으면 ''. */
export function streetOf(address: string): string {
  const first = normalizePlaceText(String(address ?? '').split(/,|\s[-–]\s/)[0] ?? '')
  const street = first.replace(/^(?:so\s+)?\d+[a-z]?(?:\/\d+)*\s+/, '').replace(/^(?:duong|pho)\s+/, '').trim()
  return street.length > 2 && !/^(?:kcn|ccn|khu|cum|phuong|p|xa|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\b/.test(first) ? street : ''
}

export interface PlaceHit { id: string; name: string; address: string }

/** 핵심 이름이 같은 후보 1곳. 여럿이면 원문 거리 이름이 주소에 있는 것만 남겨 1곳일 때만. */
export function pickCompanyPlace(company: string, address: string, hits: PlaceHit[]): { hit: PlaceHit | null; reason: string } {
  const same = hits.filter((h) => h.id && sameCoreName(company, h.name))
  if (same.length === 1) return { hit: same[0], reason: 'single_core_name' }
  if (same.length === 0) return { hit: null, reason: 'no_core_name' }
  const street = streetOf(address)
  if (!street) return { hit: null, reason: 'multiple_no_street' }
  const onStreet = same.filter((h) => ` ${normalizePlaceText(h.address)} `.includes(` ${street} `))
  return onStreet.length === 1 ? { hit: onStreet[0], reason: 'multiple_street_match' } : { hit: null, reason: onStreet.length ? 'multiple_same_street' : 'multiple_no_street_match' }
}

/** Goong AutoComplete 응답 → 후보 목록. */
export function goongPredictionHits(json: unknown): PlaceHit[] {
  const preds = (json as { predictions?: unknown[] } | null)?.predictions
  return (Array.isArray(preds) ? preds : []).flatMap((p) => {
    const x = p as { place_id?: string; description?: string; structured_formatting?: { main_text?: string; secondary_text?: string } }
    const name = x.structured_formatting?.main_text ?? ''
    return x.place_id && name ? [{ id: String(x.place_id), name: String(name), address: String(x.structured_formatting?.secondary_text ?? x.description ?? '') }] : []
  })
}

/** Google Places Text Search(New) 응답 → 후보 목록 + 좌표. */
export function googlePlaceHits(json: unknown): (PlaceHit & { lat: number; lng: number })[] {
  const places = (json as { places?: unknown[] } | null)?.places
  return (Array.isArray(places) ? places : []).flatMap((p) => {
    const x = p as { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }
    const lat = x.location?.latitude, lng = x.location?.longitude
    return x.id && x.displayName?.text && typeof lat === 'number' && typeof lng === 'number'
      ? [{ id: String(x.id), name: String(x.displayName.text), address: String(x.formattedAddress ?? ''), lat, lng }] : []
  })
}

/** 검색어: 회사 이름 + 원문 주소 뒤쪽(동·구·성). */
export function companySearchText(company: string, address: string): string {
  const area = String(address ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(-2).join(', ')
  return `${company} ${area}`.trim()
}

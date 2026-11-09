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
  // 업종 머리말(여러 낱말)은 이름의 핵심이 아니다: "SIÊU THỊ ĐIỆN MÁY MEDIAMART" ↔ "Mediamart Bắc Ninh", "BAR NEW PHOENIX" ↔ "New Phoenix Club"(#560).
  // 낱말 하나씩 빼면(예: 'trang') 사람 이름까지 지워지므로 낱말 묶음으로만 뺀다.
  // 'Việt Nam'(나라 이름)은 빼되, 따로 쓰인 'Việt'·'Nam'은 이름의 일부다("Đại Tân Việt" ≠ "Đại Tân", #560) — 공용 낱말 목록(companyTokens)이
  // 둘을 늘 빼므로 여기서만 지켜 둔다.
  const bare = ` ${normalizePlaceText(head)} `.replace(GENERIC_HEAD, ' ').replace(/ (?:viet nam|vietnam) /g, ' ').replace(/ (viet|nam)(?= )/g, ' $1x')
  const tokens = companyTokens(bare).map((t) => t.replace(/^(viet|nam)x$/, '$1')).filter((t) => !CORE_IGNORED.has(t))
  return tokens.join('')
}
// 업종 일반어·지역 이름(이름의 '핵심'이 아님). 너무 많이 빼면 다른 회사와 같아지므로 짧게 둔다.
const GENERIC_HEAD = / (?:he thong|sieu thi|dien may|khach san|thuong hieu|bar)(?= )/g
const CORE_IGNORED = new Set(['dich', 'vu', 'bao', 've', 'ninh', 'bac', 'giang', 'ha', 'noi', 'tp', 'thanh', 'pho', 'tinh', 'chi', 'nhanh', 'cn', 'co', 'so', 'nha', 'hang', 'quan', 'cua'])

/** 공고 회사 이름 ↔ 지도 업체 이름이 핵심 이름으로 같은가. 핵심 이름이 4글자보다 짧으면 판단하지 않는다(오탐 방지). */
export function sameCoreName(company: string, placeName: string): boolean {
  const a = coreName(company), b = coreName(placeName)
  if (a.length < 4 || b.length < 4) return false
  // 지도 이름이 공고 이름보다 짧으면(공고 "Đại Tân Việt" ↔ 지도 "Đại Tân") 지도 쪽 이름이 충분히 길 때만(8자) 같다고 본다 — 짧은 이름은 다른 회사일 수 있다(#560).
  return a === b || (b.startsWith(a) && a.length >= 6) || (a.startsWith(b) && b.length >= 8)
}

/** 원문 주소의 거리 이름(번지·"đường/phố" 없이). 없으면 ''. */
export function streetOf(address: string): string {
  // "27 kinh dương vương-p Vũ Ninh"처럼 붙어 쓴 '-p'·'-tỉnh'도 끊는다.
  // 번지("10/2", "Số 10")는 글자를 다듬기 전에 뗀다 — 다듬으면 "/"가 공백이 돼 "2"가 거리 이름에 남는다(Codex #616).
  const rawFirst = String(address ?? '').split(/,|\s[-–]\s|\s*[-–]\s*(?=(?:p\.?|phường|xã|tp\.?|tỉnh|q\.?|quận|huyện)\s)/iu)[0] ?? ''
  const first = normalizePlaceText(rawFirst.replace(/^\s*(?:số\s*)?\d+[a-z]?(?:\s*\/\s*\d+[a-z]?)*(?![\p{L}\d])\s*/iu, ''))
  const street = first.replace(/^(?:so\s+)?\d+[a-z]?(?:\/\d+)*\s+/, '').replace(/^(?:duong|pho|d)\s+/, '').trim() // "Đ. Triệu Việt Vương"의 Đ.(đường 줄임)도 뗀다
  return street.length > 2 && !/^(?:kcn|ccn|khu|cum|phuong|p|xa|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\b/.test(first) ? street : ''
}

export interface PlaceHit { id: string; name: string; address: string }

const ROMAN_TO_ARABIC: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' }
const PARK_NUMBERING = new RegExp(`^(?:\\d+|${Object.keys(ROMAN_TO_ARABIC).join('|')})$`)
/** 후보 주소의 공단 순번도 같은 아라비아 숫자로 맞춘다("Quế Võ III" ↔ "Quế Võ 3"). 공단 말(kcn 등) 뒤의 순번만 바꾼다. */
function arabicParkNumbers(text: string): string {
  return text.replace(/ (kcn|ccn|cong nghiep|cn)( (?:[a-z]+ ){1,2}?)(i|ii|iii|iv|v|vi)(?= )/g, (_m, a: string, b: string, r: string) => ` ${a}${b}${ROMAN_TO_ARABIC[r]}`)
}

/** 원문 주소의 공단 이름:KCN/CCN/khu công nghiệp 뒤 2낱말(+번호, 예 "que vo 2"), 쉼표·괄호·지역 말에서 끊음. 없으면 ''. */
export function parkNameOf(address: string): string {
  for (const part of String(address ?? '').split(/[,(;]|\s[-–]\s/)) {
    const m = ` ${normalizePlaceText(part)} `.match(/ (?:kcn|ccn|khu cong nghiep|cum cong nghiep|khu cn|cum cn) (.+)$/)
    if (!m) continue
    const words = m[1].trim().split(' ').filter(Boolean)
    const stop = words.findIndex((w, i) => /^(?:tinh|tp|phuong|xa|huyen|quan|khu|mo|lo|so)$/.test(w) ||
      /^(?:thanh pho|thi xa|thi tran|bac ninh|bac giang|ha noi|hai duong|hung yen)$/.test(`${w} ${words[i + 1] ?? ''}`))
    const name = (stop >= 0 ? words.slice(0, stop) : words).slice(0, 2)
    const num = words[name.length]
    // 순번은 아라비아·로마 숫자 모두(기존 공단 판독 NUMBERING과 같은 기준) — "III"가 빠지면 다른 공단과 같아진다(Codex #616).
    if (name.length && num && PARK_NUMBERING.test(num)) name.push(ROMAN_TO_ARABIC[num] ?? num)
    if (name.length) return name.join(' ')
  }
  return ''
}
/** 원문이 번지부터 적은 주소면 그 거리 이름(예: "213 Ngọc Hân Công Chúa" → "ngoc han cong chua"). 아니면 ''. */
function numberedStreet(address: string): string {
  const text = String(address ?? '')
  if (!/^\s*(?:số\s*)?\d/iu.test(text)) return ''
  const s = streetOf(text)
  // "Số 10, đường Lý Thái Tổ": 첫 칸이 번지뿐이면 다음 칸의 거리 이름(Codex #616). 그래도 거리가 없으면 거리 조건을 쓰지 않는다.
  if (s && !/^(?:so\s*)?\d+[a-z]?(?:\/\d+)*$/.test(s)) return s
  const rest = text.split(',').slice(1).join(',')
  const next = rest ? streetOf(rest) : ''
  return next && !/^(?:so\s*)?\d/.test(next) ? next : ''
}

/** 핵심 이름이 같은 후보 1곳. 여럿이면 원문 거리 이름이 주소에 있는 것만 남겨 1곳일 때만.
 *  다른 지점·다른 회사를 잘못 확정하지 않게(#560, Lee "잘못된 위치 확정은 0건"): 원문이 번지 주소인데 후보 주소에 그 거리가 없거나,
 *  원문 공단과 후보 주소의 공단이 다르면 고르지 않는다(보류). */
export function pickCompanyPlace(company: string, address: string, hits: PlaceHit[]): { hit: PlaceHit | null; reason: string } {
  const named = hits.filter((h) => h.id && sameCoreName(company, h.name))
  const numbered = numberedStreet(address), park = parkNameOf(address)
  const has = (h: PlaceHit, words: string) => ` ${normalizePlaceText(h.address)} `.includes(` ${words} `)
  const hasPark = (h: PlaceHit) => arabicParkNumbers(` ${normalizePlaceText(h.address)} `).includes(` ${park} `)
  const same = named.filter((h) => (!numbered || has(h, numbered)) && (!park || hasPark(h)))
  if (named.length && !same.length) return { hit: null, reason: numbered && !named.some((h) => has(h, numbered)) ? 'street_mismatch' : 'park_mismatch' }
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
/** Google 장소 종류(types·primaryType, Lee 2026-11-08 업종 판정용). 예전에 저장된 결과에는 없을 수 있다(빈 목록). */
export type GooglePlaceHit = PlaceHit & { lat: number; lng: number; types: string[]; primaryType: string | null }

export function googlePlaceHits(json: unknown): GooglePlaceHit[] {
  const places = (json as { places?: unknown[] } | null)?.places
  return (Array.isArray(places) ? places : []).flatMap((p) => {
    const x = p as { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number }; types?: unknown; primaryType?: unknown }
    const lat = x.location?.latitude, lng = x.location?.longitude
    const types = Array.isArray(x.types) ? x.types.filter((t): t is string => typeof t === 'string') : []
    return x.id && x.displayName?.text && typeof lat === 'number' && typeof lng === 'number'
      ? [{ id: String(x.id), name: String(x.displayName.text), address: String(x.formattedAddress ?? ''), lat, lng, types,
          primaryType: typeof x.primaryType === 'string' ? x.primaryType : null }] : []
  })
}

/** Google 검색어 — 상세 화면 Google 버튼과 같은 말(회사 이름, 원문 주소 전체)로 묻는다(Lee 2026-11-06 "구글을 따라").
 * 버튼과 다른 말(주소 뒤쪽만)로 물으면 같은 Google이라도 다른 장소가 나와 핀과 Google 목적지가 어긋난다(#5438). */
export function googleSearchText(company: string, address: string): string {
  const c = String(company ?? '').trim(), a = String(address ?? '').trim()
  return c && a ? `${c}, ${a}` : c || a
}

/** 검색어: 회사 이름 + 원문 주소 뒤쪽(동·구·성). */
export function companySearchText(company: string, address: string): string {
  const area = String(address ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(-2).join(', ')
  return `${company} ${area}`.trim()
}

// 회사 이름으로 지도 업체 찾기 — 추가 단계(Lee 2026-11-03 "비엣맵+궁 조합으로 안될 시 … 원인을 찾아서 업그레이드").
// 2026-11-03 비교(business-search-compare 41645439656): VietMap 0/11, Goong 3/11 — 원인
//   ① 공단 밖 공고는 회사 이름으로 아예 묻지 않음(번지 없으면 바로 대략 위치)
//   ② 이름 비교가 단어까지 똑같아야 함("JOY THÁI" ↔ "JoyThai - Thai Cuisine & Hotpot" 탈락)
//   ③ 같은 이름 지점이 여럿이면 거리로 좁히지 않고 포기
// 기존 단계(번지·회사+공단·공단 입구·동·성 대략 위치)는 그대로 두고, 공단 밖 공고에 이 단계를 더한다.
// 채택: 핵심 이름이 같은 후보 1곳(여럿이면 원문 거리 이름으로 좁혀 1곳) → 원래 성 경계 안인지는 resolver가 다시 본다.
// 결과는 '대략 위치(area)' — 화면은 chưa xác minh 그대로, 핀만 실제 업체 자리.
import { companyTokens, normalizePlaceText } from './locationCandidateMatch'
import { findIndustrialPark, foldText } from './industrialPark'
import { administrativeAreaForTarget } from './administrativeArea'

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
  const first = normalizePlaceText(String(address ?? '').split(/,|\s[-–]\s|\s*[-–]\s*(?=(?:p\.?|phường|xã|tp\.?|tỉnh|q\.?|quận|huyện)\s)/iu)[0] ?? '')
  const street = first.replace(/^(?:so\s+)?\d+[a-z]?(?:\/\d+)*\s+/, '').replace(/^(?:duong|pho|d)\s+/, '').trim() // "Đ. Triệu Việt Vương"의 Đ.(đường 줄임)도 뗀다
  return street.length > 2 && !/^(?:kcn|ccn|khu|cum|phuong|p|xa|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\b/.test(first) ? street : ''
}

export interface PlaceHit { id: string; name: string; address: string }

const NUMBERING_WORD = /^(?:\d+|i|ii|iii|iv|v|vi)$/
// "a|b": b가 a에 "mở rộng"만 붙은 이름인가
const EXTENSION = /^([a-z0-9 ]+)\|\1 (?:khu )?mo rong$/
/** 원문 주소의 공단 이름: KCN/CCN/khu công nghiệp 뒤 2낱말(+번호, 예 "que vo 2"), 쉼표·괄호·지역 말에서 끊음. 없으면 ''. */
export function parkNameOf(address: string): string {
  for (const part of String(address ?? '').split(/[,(;]|\s[-–]\s/)) {
    const m = ` ${normalizePlaceText(part)} `.match(/ (?:kcn|ccn|khu cong nghiep|cum cong nghiep|khu cn|cum cn) (.+)$/)
    if (!m) continue
    const words = m[1].trim().split(' ').filter(Boolean)
    const stop = words.findIndex((w, i) => /^(?:tinh|tp|phuong|xa|huyen|quan|khu|mo|lo|so)$/.test(w) ||
      /^(?:thanh pho|thi xa|thi tran|bac ninh|bac giang|ha noi|hai duong|hung yen)$/.test(`${w} ${words[i + 1] ?? ''}`))
    const name = (stop >= 0 ? words.slice(0, stop) : words).slice(0, 2)
    const num = words[name.length]
    if (name.length && num && /^(?:\d+|i|ii|iii|iv|v|vi)$/.test(num)) name.push(num)
    if (name.length) return name.join(' ')
  }
  return ''
}
/** 원문이 번지부터 적은 주소면 그 거리 이름(예: "213 Ngọc Hân Công Chúa" → "ngoc han cong chua"). 아니면 ''. */
function numberedStreet(address: string): string {
  const text = String(address ?? '')
  if (!/^\s*(?:số\s*)?\d/iu.test(text)) return ''
  // 번지 전체("10/2", "25-27", "Số 10,")를 먼저 떼고 거리 이름을 읽는다(Codex #616: 슬래시·쉼표 번지).
  const rest = text.replace(/^\s*(?:số\s*)?\d+\p{L}?(?:\s*[\/-]\s*\d+\p{L}?)*\s*,?\s*/iu, '')
  const s = rest ? streetOf(rest) : ''
  return s && !/^\d/.test(s) ? s : ''
}

/** 핵심 이름이 같은 후보 1곳. 여럿이면 원문 거리 이름이 주소에 있는 것만 남겨 1곳일 때만.
 *  다른 지점·다른 회사를 잘못 확정하지 않게(#560, Lee "잘못된 위치 확정은 0건"): 원문이 번지 주소인데 후보 주소에 그 거리가 없거나,
 *  원문 공단과 후보 주소의 공단이 다르면 고르지 않는다(보류). */
export function pickCompanyPlace(company: string, address: string, hits: PlaceHit[]): { hit: PlaceHit | null; reason: string } {
  const named = hits.filter((h) => h.id && sameCoreName(company, h.name))
  const numbered = numberedStreet(address)
  const has = (h: PlaceHit, words: string) => ` ${normalizePlaceText(h.address)} `.includes(` ${words} `)
  // 공단: 공단 표(industrialPark — 로마 숫자·순번 구분)에 있으면 표의 공단끼리 비교, 표에 없으면 원문 공단 이름 글자로(Codex #616).
  const tablePark = findIndustrialPark(address), park = tablePark ? '' : parkNameOf(address)
  const samePark = (h: PlaceHit) => {
    if (!tablePark) {
      if (!park) return true
      // 표에 없는 공단도 순번은 지킨다: 원문 "Quế Võ"인데 후보가 "Quế Võ 2"면 다른 공단(Codex #616)
      const w = ` ${normalizePlaceText(h.address)} `, i = w.indexOf(` ${park} `)
      if (i < 0) return false
      const next = w.slice(i + park.length + 2).split(' ')[0]
      return !(next && NUMBERING_WORD.test(next) && !NUMBERING_WORD.test(park.split(' ').pop() ?? ''))
    }
    const theirs = findIndustrialPark(h.address)
    // 같은 공단, 또는 "mở rộng"(확장 구역)만 다른 같은 공단(KCN Yên Phong ↔ KCN Yên Phong mở rộng, #5438). 순번(1·2·III)이 다르면 다른 공단.
    if (theirs) return theirs.id === tablePark.id || tablePark.aliases.some((a) => theirs.aliases.some((b) => EXTENSION.test(`${a}|${b}`) || EXTENSION.test(`${b}|${a}`)))
    // 지도 주소는 "KCN" 없이 "Quế Võ, Bắc Ninh"처럼 쓰기도 한다 → 표의 이름이 그대로 있고 뒤에 다른 순번(1·2·III…)이 붙지 않을 때만 같은 공단.
    const words = ` ${foldText(h.address).replace(/[^a-z0-9]+/g, ' ')} `
    const names = [...new Set(tablePark.aliases.flatMap((a) => [a, a.replace(/ (?:khu )?mo rong$/, '')]))] // 확장 구역은 본 공단 이름으로도
    // 공단 낱말 바로 뒤에 이름이 있을 때만 — "Phường Quế Võ"처럼 행정구역 이름만 같은 시내 주소는 공단이 아니다(Codex #616).
    return names.some((a) => {
      const m = words.match(new RegExp(` (?:kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep|khu cn|cum cn) ${a} `))
      const i = m ? (m.index ?? 0) + m[0].length - a.length - 2 : -1
      if (i < 0) return false
      const next = words.slice(i + a.length + 2).split(' ')[0]
      return !(next && /^(?:\d+|i|ii|iii|iv|v|vi)$/.test(next) && !/(?:\d+|i|ii|iii|iv|v|vi)$/.test(a))
    })
  }
  const same = named.filter((h) => (!numbered || has(h, numbered)) && samePark(h))
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

/** 같은 사업장을 Google에 두 번 묻지 않게(#560 Lee 2026-11-09 "같은 사업장 중복 검색 줄이기"): 검색 결과를 저장할 사업장 열쇠.
 *  회사 핵심 이름 + (번지·거리 | 공단) + 성. 번지·공단이 없으면 '' — 그때는 검색 글자 그대로 저장한다(지점을 잘못 합치지 않게).
 *  저장하는 것은 후보 목록이고, 어느 후보를 고를지는 매번 그 공고의 주소로 pickCompanyPlace가 다시 정한다(다른 지점은 거리·공단 확인에서 걸러짐). */
export function siteCacheKey(company: string, address: string): string {
  const core = coreName(company)
  if (core.length < 4) return ''
  const house = String(address ?? '').match(/^\s*(?:số\s*)?(\d+\p{L}?(?:\s*[\/-]\s*\d+\p{L}?)*)/iu)?.[1]?.replace(/\s+/g, '') ?? ''
  const street = numberedStreet(address)
  const park = findIndustrialPark(address)
  // 같은 공단 안 다른 구획(Lô C3 / Lô D5)은 다른 사업장(Codex #619). 구획을 안 적은 주소는 따로 센다(합치지 않음).
  const site = street && house ? `st:${house} ${street}` : park ? `park:${park.id}|lot:${lotOf(address)}` : ''
  if (!site) return ''
  const area = administrativeAreaForTarget(address, '')
  const province = area ? area.parentKey ?? area.key : ''
  // 번지 열쇠는 동·구까지 같아야 같은 사업장(Codex #619: 같은 성 안 다른 동의 "12 Lý Thái Tổ"는 다른 지점). 동·구를 안 적은 주소는 따로 센다(합치지 않음).
  const locality = street && house ? `|${localityOf(address, area)}` : ''
  return `${core}|${site}|${province}${locality}` // 원래 성 단위("TP Bắc Ninh"·"Bắc Ninh" 같은 성)
}

/** 공단 안 구획 번호("Lô C3", "lô số D-5", "Lot CN-02") — 글자·숫자만, 대문자. 없으면 ''. */
function lotOf(address: string): string {
  const m = foldText(String(address ?? '')).match(/(?:^| )(?:lo|lot)(?: dat)?(?: so)? ([a-z]{0,4} ?\d+[a-z]?(?: \d+[a-z]?)*)(?: |$)/)
  return m ? m[1].replace(/ /g, '').toUpperCase() : ''
}

const LOCALITY_PREFIX = /^(?:phuong|p|xa|x|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\s+/
/** 주소의 동·구 글자(번지·거리 칸과 성·시 이름·나라 이름 빼고, 머리말 phường·xã·quận·huyện·TP 등 떼고). */
function localityOf(address: string, area: { key: string; aliases: string[]; parentKey?: string } | null): string {
  const aliases = new Set([...(area?.aliases ?? []), ...[area?.key, area?.parentKey].filter(Boolean).map((k) => String(k).replace(/^[a-z]+:/, ''))])
  const parts = String(address ?? '').split(',').slice(1)
    .map((p) => normalizePlaceText(p).replace(/\./g, ' ').replace(/\s+/g, ' ').trim().replace(LOCALITY_PREFIX, '').trim())
    .filter((p) => p && !aliases.has(p) && !/^(?:viet nam|vietnam)$/.test(p) && !/^\d+$/.test(p))
  return [...new Set(parts)].sort().join('+')
}

/** Google 결과 저장 열쇠 — 위치 확인·로고·업종이 같은 함수(한 곳). 첫 열쇠에 저장하고, 읽을 때는 차례로 찾는다.
 *  사업장(회사+번지/공단+성)을 정하면 사업장 열쇠가 먼저, 그다음 예전 검색 글자 열쇠(이미 저장된 결과를 다시 묻지 않게). */
export function googleCacheKeys(company: string, address: string): string[] {
  const site = siteCacheKey(company, address)
  const text = JSON.stringify(['company-v2', 'google', googleSearchText(company, address)])
  return site ? [JSON.stringify(['company-v3', 'google', site]), text] : [text]
}

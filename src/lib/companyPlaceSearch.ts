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
import { NAME_HEAD_WORDS } from './shopKinds'

/** 이름 앞뒤 수식어를 뺀 핵심 이름(띄어쓰기 없이). "JoyThai - Thai Cuisine & Hotpot" → "joythai". */
export function coreName(name: string, { keepShopHead = false } = {}): string {
  const head = String(name ?? '').split(/\s[-–|]\s|[|(]/)[0] ?? ''
  // 업종 머리말(여러 낱말)은 이름의 핵심이 아니다: "SIÊU THỊ ĐIỆN MÁY MEDIAMART" ↔ "Mediamart Bắc Ninh", "BAR NEW PHOENIX" ↔ "New Phoenix Club"(#560).
  // 낱말 하나씩 빼면(예: 'trang') 사람 이름까지 지워지므로 낱말 묶음으로만 뺀다.
  // 'Việt Nam'(나라 이름)은 빼되, 따로 쓰인 'Việt'·'Nam'은 이름의 일부다("Đại Tân Việt" ≠ "Đại Tân", #560) — 공용 낱말 목록(companyTokens)이
  // 둘을 늘 빼므로 여기서만 지켜 둔다.
  const bare = ` ${normalizePlaceText(head)} `.replace(GENERIC_HEAD, ' ').replace(/\s+/g, ' ').replace(keepShopHead ? /^$/ : SHOP_HEAD, ' ').replace(/ (?:viet nam|vietnam) /g, ' ').replace(/ (viet|nam)(?= )/g, ' $1x')
  const tokens = companyTokens(bare).map((t) => t.replace(/^(viet|nam)x$/, '$1')).filter((t) => !CORE_IGNORED.has(t))
  return tokens.join('')
}
// 업종 일반어·지역 이름(이름의 '핵심'이 아님). 너무 많이 빼면 다른 회사와 같아지므로 짧게 둔다.
const GENERIC_HEAD = / (?:he thong|sieu thi|dien may|khach san|thuong hieu|bar)(?= )/g
// 이름 맨 앞에 붙은 가게 종류·소개소 낱말(shopKinds 한 곳): "Siêu Thị Mẹ Bầu & Em Bé Con Cưng" ↔ "CON CƯNG"(2026-11-11). 앞머리만 뗀다(이름 중간 낱말은 이름의 일부).
const SHOP_HEAD = new RegExp(`^ (?:(?:${NAME_HEAD_WORDS.map((w) => normalizePlaceText(w)).filter(Boolean).join('|')}) )+`)
const CORE_IGNORED = new Set(['dich', 'vu', 'bao', 've', 'ninh', 'bac', 'giang', 'ha', 'noi', 'tp', 'thanh', 'pho', 'tinh', 'chi', 'nhanh', 'cn', 'co', 'so', 'nha', 'hang', 'quan', 'cua'])

/** 공고 회사 이름 ↔ 지도 업체 이름이 핵심 이름으로 같은가. 핵심 이름이 4글자보다 짧으면 판단하지 않는다(오탐 방지). */
export function sameCoreName(company: string, placeName: string): boolean {
  // 가게 종류 앞머리를 떼기 전 이름으로 먼저 본다(Codex #674: "Nệm Vạn Thành" ↔ 같은 이름이 앞머리를 떼면 3글자가 되어 탈락하던 것) — 예전 판정 그대로.
  return coreMatch(coreName(company, { keepShopHead: true }), coreName(placeName, { keepShopHead: true })) || coreMatch(coreName(company), coreName(placeName))
}
function coreMatch(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false
  // 지도 이름이 공고 이름보다 짧으면(공고 "Đại Tân Việt" ↔ 지도 "Đại Tân") 지도 쪽 이름이 충분히 길 때만(8자) 같다고 본다 — 짧은 이름은 다른 회사일 수 있다(#560).
  return a === b || (b.startsWith(a) && a.length >= 6) || (a.startsWith(b) && b.length >= 8)
}

/** 원문 주소의 거리 이름(번지·"đường/phố" 없이). 없으면 ''. */
export function streetOf(address: string): string {
  // "27 kinh dương vương-p Vũ Ninh"처럼 붙어 쓴 '-p'·'-tỉnh'도 끊는다.
  // 슬래시·줄표 번지("10/2", "25-27")는 글자 그대로 먼저 뗀다 — 정규화하면 "10 2"가 되어 '2'가 거리 이름에 붙는다(Codex #674).
  const raw = (String(address ?? '').split(/,|\s[-–]\s|\s*[-–]\s*(?=(?:p\.?|phường|xã|tp\.?|tỉnh|q\.?|quận|huyện)\s)/iu)[0] ?? '').replace(/^\s*(?:số\s*)?\d+\p{L}?(?:\s*[\/-]\s*\d+\p{L}?)+\s+/iu, '')
  const first = normalizePlaceText(raw)
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
  if (onStreet.length === 1) return { hit: onStreet[0], reason: 'multiple_street_match' }
  // 같은 체인이 같은 거리에 여러 곳이면(2026-11-11 KRIK 152·340 Trần Hưng Đạo) 원문 번지가 그 후보 주소에 '번지 + 거리'로 있는 곳만.
  // 번지가 없거나 번지까지 같은 곳이 1곳이 아니면 지금처럼 보류(다른 지점을 고르지 않는다).
  // 번지는 통째로 비교한다(Codex #674: "1/152"를 "152"로 보지 않게 — 슬래시·줄표 번지를 그대로 둔 글자로 읽는다).
  const houseText = (t: string) => ` ${String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s*([/-])\s*(?=\d)/g, '$1').replace(/[^a-z0-9/-]+/g, ' ').replace(/\s+/g, ' ').trim()} `
  const no = /^\s*(?:số\s*)?(\d+[a-z]?(?:\s*[/-]\s*\d+[a-z]?)*)\s/iu.exec(address)?.[1]?.toLowerCase().replace(/\s+/g, '')
  // 후보의 번지 = 주소 맨 앞 번지가 바로 그 거리에 붙어 있을 때만(Codex #674: "12 Ngõ 152 Trần Hưng Đạo"의 152는 골목 번호지 집 번지가 아니다).
  const houseOf = (h: PlaceHit) => new RegExp(`^ (?:so )?(\\d+[a-z]?(?:[/-]\\d+[a-z]?)*) (?:d |duong |pho )?${street} `).exec(houseText(h.address))?.[1]
  const atNo = no ? onStreet.filter((h) => houseOf(h) === no) : []
  if (atNo.length === 1) return { hit: atNo[0], reason: 'multiple_house_number_match' }
  return { hit: null, reason: onStreet.length ? 'multiple_same_street' : 'multiple_no_street_match' }
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

/** Google 결과 저장 열쇠 — 위치 확인·로고·업종이 같은 함수(한 곳). 검색 글자(회사 이름 + 원문 주소)가 완전히 같을 때만 다시 쓴다
 *  (Lee 2026-11-10 "나": 비슷한 사업장 자동 병합은 빼고 기존 완전 일치 방식). 배열인 것은 읽는 쪽이 차례로 찾는 모양을 그대로 쓰기 위함. */
export function googleCacheKeys(company: string, address: string): string[] {
  return [JSON.stringify(['company-v2', 'google', googleSearchText(company, address)])]
}

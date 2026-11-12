/**
 * 업종으로 큰 분류 정하기 — Lee 2026-11-01 (#5247 Wallace): "업체 이름으로 어떤 일을 하는지 큰 틀에서 볼 수 있다. 서비스업이라고 쓰면 된다."
 * 원문에 실제 업무(서빙·주방·계산 등)가 없어 직업 코드를 못 정한 수집 공고에만 쓴다.
 *  1) 업체 이름(또는 업체 이름이 든 원문 줄)에 가게 업종 단어가 있으면 → 공식 분류 5 "Nhân viên dịch vụ và bán hàng"
 *  2) 이름만으로 모르면 → 위치 확인이 저장해 둔 Google 결과(같은 이름 1곳·원래 성 안)의 장소 종류(Lee 2026-11-08, businessFromGoogle)
 *  3) Google이 그 장소를 모를 때만 → 인터넷 검색 결과에서 같은 업체 이름 + 공고 주소(번지·도로)가 함께 나온 매장만 인정(scripts/ocr/business-type.mjs)
 *  4) 모두 안 되면 아무것도 정하지 않는다(비공개 유지 → 알림)
 * 근거(occupation_evidence)는 원문에 있는 업체 이름 글자 그대로(DB 규칙 R8: 근거는 원문 안에 있어야 함). 검색 출처는 ocr_check.business_type에 남긴다.
 * 업무 칸에는 원문에 있는 가게 낱말로 "Nhân viên cửa hàng" 같은 한 줄을 보여 준다(지어낸 업무 없음).
 */
import { bare, detailSections } from './jobDetailSections.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'

export const SERVICE_CODE = '5'
export const SERVICE_NAME = 'Nhân viên dịch vụ và bán hàng'

// 가게 업종 낱말(악센트 뺀 소문자, 낱말 경계). 공장·사무 업종 낱말은 넣지 않는다. 'lau'(lâu dài)·'pho'(phố)·'kem'(kèm)처럼 겹치는 낱말은 넣지 않음.
// 업종 종류(kind)는 메뉴 칸을 정하는 데 쓴다(2026-11-01: 음식점이 "Vệ sinh / Giúp việc" 칸에 나오던 문제) — DB category_for_job.
const KIND_WORDS: Array<{ kind: BusinessKind; re: RegExp }> = [
  { kind: 'fnb', re: /\b(?:coffee|cafe|ca phe|tra sua|milk tea|nha hang|quan an|quan nhau|quan nuong|quan lau|ga ran|buffet|bakery|tiem banh|banh mi|pizza|com tam)\b/ },
  { kind: 'retail', re: /\b(?:cua hang|sieu thi|minimart)\b/ },
  { kind: 'service', re: /\b(?:spa|salon|nail|karaoke|khach san|hotel|homestay)\b/ },
]
export type BusinessKind = 'fnb' | 'retail' | 'service'
const kindOf = (texts: string[]): BusinessKind | null => KIND_WORDS.find((k) => texts.some((t) => k.re.test(bare(t))))?.kind ?? null

export interface BusinessJob { company?: string | null; title?: string | null; source_text?: string | null; location?: string | null }
export interface BusinessType { code: string; kind: BusinessKind; evidence: string; duty: string; method: 'name' | 'google' | 'web'; url?: string; quote?: string; place_id?: string; google_types?: string[] }

const nfc = (s: string) => s.normalize('NFC')

/** 원문 안에 실제로 있는 업체 이름 글자(대소문자 원문 그대로). 없으면 null. */
export function companyInSource(job: BusinessJob): string | null {
  const company = nfc(String(job.company ?? '').trim())
  const src = nfc(String(job.source_text ?? ''))
  if (company.length < 3) return null
  const at = src.toLowerCase().indexOf(company.toLowerCase())
  return at >= 0 ? src.slice(at, at + company.length) : null
}

/**
 * 원문에 실제 업무가 적혀 있나(#728 S7, 6043: 점검·수리 업무가 적힌 공고가 쇼핑몰 장소 종류로 서비스·판매가 됨).
 * 이 규칙은 "업무 미기재"일 때만 쓴다(Lee 2026-11-01·머리말). 판정은 상세 화면이 업무 칸(01)을 정하는 기존 함수 그대로 — 새 낱말표 없음.
 * 업무가 적혀 있으면 장소 종류·검색 결과로 업종을 추정하지 않는다(직업 분류는 원문 업무로, 못 정하면 미분류·보류).
 */
export function dutyStated(job: BusinessJob): boolean {
  const description = buildDescriptionFromSources([{ name: 'source_text', text: String(job.source_text ?? '') }], {}).description
  return (detailSections(description, {}).sections.find((s) => s.key === '01')?.lines.length ?? 0) > 0
}

/** 업무 칸 한 줄: 원문에 있는 가게 낱말만 쓴다. */
export function dutyLine(source: string | null | undefined): string {
  const b = bare(String(source ?? ''))
  if (/\bnha hang\b/.test(b)) return 'Nhân viên nhà hàng'
  if (/\bcua hang\b/.test(b)) return 'Nhân viên cửa hàng'
  if (/\bquan\b/.test(b)) return 'Nhân viên quán'
  return 'Nhân viên dịch vụ'
}

/** 1) 업체 이름(또는 업체 이름이 든 원문 줄)의 업종 낱말로 정하기. */
export function businessFromName(job: BusinessJob): BusinessType | null {
  const evidence = companyInSource(job)
  if (!evidence) return null
  // 업체 이름 앞 두 낱말(예: "trung nguyen")이 든 원문 줄도 본다("Trung Nguyên Legend – Thương hiệu cà phê").
  const head = bare(evidence).split(' ').slice(0, 2).join(' ')
  const lines = nfc(String(job.source_text ?? '')).split('\n').filter((l) => head.length >= 5 && bare(l).includes(head))
  const kind = kindOf([String(job.company ?? ''), ...lines])
  return kind ? { code: SERVICE_CODE, kind, evidence, duty: dutyLine(job.source_text), method: 'name' } : null
}

/** Google 장소 종류 → 업종(Lee 2026-11-08). 대표 종류(primaryType)를 먼저 보고, 없으면 종류 목록(types) 순서대로.
 *  가게(음식·판매·서비스)로 볼 수 있는 종류만 넣는다. 공장·사무실·학교·병원·관공서 등은 넣지 않는다(→ 정하지 않음). */
const FNB_TYPES = /^(?:restaurant|.+_restaurant|cafe|coffee_shop|tea_house|bakery|bar|pub|wine_bar|food_court|fast_food_restaurant|meal_takeaway|meal_delivery|ice_cream_shop|dessert_shop|juice_shop|confectionery|deli|snack_bar|cafeteria|bistro|diner|.+_cafe)$/
const RETAIL_TYPES = /^(?:store|.+_store|supermarket|convenience_store|shopping_mall|market|grocery_store|department_store|pharmacy|drugstore|wholesaler)$/
const SERVICE_TYPES = /^(?:spa|beauty_salon|hair_salon|hair_care|nail_salon|barber_shop|massage|sauna|wellness_center|lodging|hotel|motel|hostel|guest_house|inn|resort_hotel|bed_and_breakfast|karaoke|night_club|gym|fitness_center|laundry|car_wash|car_repair|amusement_center|bowling_alley|movie_theater)$/
export function kindFromGoogleTypes(primaryType: string | null | undefined, types: string[] | null | undefined): BusinessKind | null {
  // 대표 종류가 있으면 그것만 본다(공장 대표 종류 + 곁가지 store 같은 경우를 가게로 잘못 보지 않게).
  for (const t of primaryType ? [primaryType] : (types ?? [])) {
    if (FNB_TYPES.test(t)) return 'fnb'
    if (RETAIL_TYPES.test(t)) return 'retail'
    if (SERVICE_TYPES.test(t)) return 'service'
  }
  return null
}

/** 2) Google 장소 종류로 정하기. place = cachedGooglePlace 결과(같은 이름 1곳·원래 성 안). 근거는 원문 속 업체 이름(R8). */
export function businessFromGoogle(job: BusinessJob, place: { id: string; types: string[]; primaryType: string | null } | null): BusinessType | null {
  if (!place) return null
  const evidence = companyInSource(job)
  const kind = kindFromGoogleTypes(place.primaryType, place.types)
  if (!evidence || !kind || dutyStated(job)) return null
  return { code: SERVICE_CODE, kind, evidence, duty: dutyLine(job.source_text), method: 'google', place_id: place.id,
    google_types: [place.primaryType, ...place.types].filter((x): x is string => !!x).slice(0, 8) }
}

/** 공고 주소의 "번지 + 도로" 부분(예: "216 Nguyễn Trãi"). 없으면 null — 검색 결과를 같은 매장으로 인정할 수 없다. */
export function streetOf(location: string | null | undefined): string | null {
  const first = nfc(String(location ?? '')).split(',')[0].trim()
  return /^\d+[a-z]?\s+\S+/i.test(first) ? first : null
}

/** 검색 질문을 바꾸면 이 값도 바꾼다(같은 공고를 새 질문으로 한 번 다시 확인). */
export const WEB_PROMPT_VERSION = 'web-v4'  // 질문이나 확인 규칙(guardWebAnswer)을 바꾸면 올린다

export function buildWebPrompt(job: BusinessJob): string {
  return [
    `Tìm trên web cửa hàng/doanh nghiệp tên "${job.company}" tại địa chỉ "${job.location}".`,
    'Đầu tiên trích dẫn NGUYÊN VĂN (có trích nguồn) câu trong kết quả tìm kiếm có cả tên cửa hàng và địa chỉ (số nhà, tên đường).',
    'Sau đó cho biết loại hình kinh doanh, dòng cuối chỉ là JSON: {"type": "fnb" | "retail" | "service" | "other" | "unknown", "name": "...", "address": "..."}',
    'fnb = ăn uống (nhà hàng, quán, cà phê, gà rán...), retail = bán lẻ, service = dịch vụ khác (spa, khách sạn...). Không chắc thì "unknown".',
  ].join('\n')
}

/**
 * 2) 검색 답 검사: 검색 결과 인용문(citations) 하나에 업체 이름 앞 낱말과 공고 번지·도로가 함께 있어야 같은 매장으로 인정한다.
 * AI의 말만으로는 정하지 않는다.
 */
export function guardWebAnswer(job: BusinessJob, answer: unknown, citations: Array<{ url?: string; cited_text?: string }>): BusinessType | null {
  const a = (answer && typeof answer === 'object' ? answer : {}) as { type?: unknown }
  if (!['fnb', 'retail', 'service'].includes(String(a.type))) return null
  const evidence = companyInSource(job)
  const street = streetOf(job.location)
  if (!evidence || !street || dutyStated(job)) return null
  const brand = bare(evidence).split(' ')[0]
  // "Số 216 Đường Nguyễn Trãi"도 "216 Nguyễn Trãi"와 같은 주소로 본다(số·đường·phố 낱말만 뺌).
  const addr = (t: string) => bare(t).replace(/\b(?:so|duong|pho)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
  const streetB = addr(street)
  // 인용문은 짧게 잘리므로 같은 출처(URL)의 인용문은 이어서 본다. 출처가 다르면 섞지 않는다.
  const byUrl = new Map<string, string>()
  for (const c of citations) if (c.url) byUrl.set(c.url, (byUrl.get(c.url) ?? '') + ' ' + String(c.cited_text ?? ''))
  const match = [...byUrl].find(([, text]) => { const t = ` ${addr(text)} `.replace(/[^a-z0-9]+/g, ' '); return brand.length >= 3 && t.includes(` ${brand} `) && t.includes(` ${streetB} `) })
  if (!match) return null
  return { code: SERVICE_CODE, kind: String(a.type) as BusinessKind, evidence, duty: dutyLine(job.source_text), method: 'web', url: match[0], quote: match[1].trim().slice(0, 300) }
}

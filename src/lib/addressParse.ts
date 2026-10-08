// 공고 주소 글자 분석(번지·도로명 추출, 시·군까지만 있는 "Khu vực rộng" 판정). 의존성 없음 — 공고 상세 화면과 관리자 검색이 함께 쓴다.
import { normalizePlaceText } from './locationCandidateMatch'

const WARD_LEVEL = /^(phuong|xa|thi tran|p|x|tt)\s/
const DISTRICT_LEVEL = /^(huyen|thi xa|thanh pho|quan|tp|tx|h|q|tinh|t)\s/
// 번지·도로 앞뒤의 일반어: 이름 비교에서 제외한다. ("to"는 "Thái Tổ" 같은 이름에 쓰여 제외하지 않는다.)
const GENERIC = new Set(['so', 'sn', 'duong', 'pho', 'ngo', 'ngach', 'hem', 'lo', 'thua', 'dat', 'thon', 'xom', 'ap', 'kdc', 'kcn', 'ccn', 'va', 'and', 'd', 'p', 'q', 'tp', 'tx', 'khu'])
const KCN_START = /^(kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep)\b/

const segmentsOf = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean)
// "P, Võ Cường"처럼 약어만 따로 쉼표로 떨어진 구간("P")도 행정구역의 시작으로 본다.
const BARE_ABBREV = /^(p|x|tt|q|h|tp|tx|t)$/
const isAdminSegment = (seg: string) => { const n = normalizePlaceText(seg); return WARD_LEVEL.test(n) || DISTRICT_LEVEL.test(n) || BARE_ABBREV.test(n) }

export interface StreetAddress {
  /** 행정구역 앞의 자유 텍스트 구간 */
  street: string
  numbers: string[]
  nameTokens: string[]
  /** 번지와 도로명이 모두 있어 주소 검색이 가능한지 */
  searchable: boolean
  /** 번지·도로·thôn·lô 같은 구체적 위치 표현이 있는지 */
  detailed: boolean
}

/** 구간 앞머리의 "회사 소개: "·"상호 – " 꼬리표를 떼고 주소 글자만 남긴다. */
const stripLabel = (seg: string) => cutInlineAdmin(seg.split(':').pop()!.split(/\s[–-]\s/).pop()!.trim())

/** 쉼표 없이 같은 구간 안에 이어 붙은 행정구역 약어("37 Đ. Lý Thái Tổ P. Võ Cường")부터는 주소로 보지 않는다. 점이 있는 약어만 인정한다. */
const cutInlineAdmin = (text: string) => text.replace(/\s+(?:P|Q|TP|TX|TT)\.\s*\p{L}.*$/iu, '').trim()

/** 앞머리 약어 "Đ."(đường)를 풀어 검색 글자로 쓴다. 이름 비교에는 영향이 없다(둘 다 GENERIC). */
const expandRoadAbbrev = (text: string) => text.replace(/(^|\s)[Đđ]\.\s*(?=\S)/g, '$1Đường ')

interface LeadInfo { tokens: string[]; numbers: string[]; nameTokens: string[]; hasMarker: boolean; kcn: boolean }

function analyzeLead(seg: string): LeadInfo {
  const folded = normalizePlaceText(seg)
  const tokens = folded.split(' ').filter(Boolean)
  return {
    tokens,
    numbers: tokens.filter((t) => /\d/.test(t)),
    nameTokens: tokens.filter((t) => !/\d/.test(t) && !GENERIC.has(t) && t.length > 1),
    hasMarker: tokens.some((t) => GENERIC.has(t) && t !== 'khu' && t !== 'kcn' && t !== 'ccn' && t !== 'va' && t !== 'and'),
    kcn: KCN_START.test(folded),
  }
}

/**
 * 공고 주소에서 번지·도로명을 뽑는다.
 * - 행정구역(phường/xã·quận/huyện·성, "P."·"TP."·"TX."·"T." 약어 포함) 앞의 구간만 본다.
 * - 구간 앞의 "회사 소개: "·"상호 – " 꼬리표는 버린다.
 * - 상호만 따로 적힌 앞 구간("Pizza Hut, 1A Đ. Lê Thái Tổ, …")은 건너뛰고 번지·도로 표현이 있는 첫 구간부터 주소로 본다.
 */
export function parseStreetAddress(raw: string): StreetAddress {
  const segs = segmentsOf(raw)
  const lead: string[] = []
  for (const s of segs) { if (isAdminSegment(s)) break; lead.push(s) }
  const empty: StreetAddress = { street: '', numbers: [], nameTokens: [], searchable: false, detailed: false }
  if (lead.length === 0) return empty
  const cleaned = lead.map(stripLabel).filter(Boolean)
  if (cleaned.length === 0) return empty
  let pick = cleaned.findIndex((c) => { const a = analyzeLead(c); return !a.kcn && (a.numbers.length > 0 || a.hasMarker) })
  if (pick < 0) pick = 0
  const info = analyzeLead(cleaned[pick])
  const detailed = !info.kcn && (info.numbers.length > 0 || info.hasMarker)
  return {
    street: [expandRoadAbbrev(cleaned[pick]), ...cleaned.slice(pick + 1)].join(', '),
    numbers: info.numbers,
    nameTokens: info.nameTokens,
    searchable: detailed && info.numbers.length > 0 && info.nameTokens.length > 0,
    detailed,
  }
}

/** 주소에 서로 다른 시·도(예: Hải Phòng + Bắc Ninh)가 섞여 있으면 어느 쪽 번지인지 알 수 없다. */
export function hasConflictingProvinces(raw: string): boolean {
  const cores = new Set(segmentsOf(raw)
    .map((x) => normalizePlaceText(x))
    .filter((n) => /^(thanh pho|tp|tinh|t)\s/.test(n))
    .map((n) => n.replace(/^(thanh pho|tp|tinh|t)\s+/, '').trim())
    .filter(Boolean))
  return cores.size > 1
}

export const isDetailedAddress = (raw: string): boolean => parseStreetAddress(raw).detailed

/** 시·군·구(huyện)까지만 있고 phường/xã와 번지·도로가 없는 주소 — 상세 화면에 "Khu vực rộng"를 붙인다. */
export function isWideAreaAddress(raw: string): boolean {
  const segs = segmentsOf(raw)
  if (segs.length === 0) return false
  if (segs.some((s) => WARD_LEVEL.test(normalizePlaceText(s)))) return false
  return !parseStreetAddress(raw).detailed
}


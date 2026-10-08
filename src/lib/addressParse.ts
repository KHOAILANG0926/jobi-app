// 공고 주소 글자 분석(번지·도로명 추출, 시·군까지만 있는 "Khu vực rộng" 판정). 의존성 없음 — 공고 상세 화면과 관리자 검색이 함께 쓴다.
import { normalizePlaceText } from './locationCandidateMatch'

const WARD_LEVEL = /^(phuong|xa|thi tran|p|x|tt)\s/
const DISTRICT_LEVEL = /^(huyen|thi xa|thanh pho|quan|tp|tx|h|q|tinh|t)\s/
// 번지·도로 앞뒤의 일반어: 이름 비교에서 제외한다. ("to"는 "Thái Tổ" 같은 이름에 쓰여 제외하지 않는다.)
const GENERIC = new Set(['so', 'sn', 'duong', 'pho', 'ngo', 'ngach', 'hem', 'lo', 'thua', 'dat', 'thon', 'xom', 'ap', 'kdc', 'kcn', 'ccn', 'va', 'and', 'd', 'p', 'q', 'tp', 'tx', 'khu'])
const KCN_START = /^(kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep)\b/

const segmentsOf = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean)
const isAdminSegment = (seg: string) => { const n = normalizePlaceText(seg); return WARD_LEVEL.test(n) || DISTRICT_LEVEL.test(n) }

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

/** 공고 주소에서 번지·도로명을 뽑는다. 첫 구간의 "회사 소개: " 앞머리·"상호 – " 앞머리는 버린다. */
export function parseStreetAddress(raw: string): StreetAddress {
  const segs = segmentsOf(raw)
  const lead: string[] = []
  for (const s of segs) { if (isAdminSegment(s)) break; lead.push(s) }
  const empty: StreetAddress = { street: '', numbers: [], nameTokens: [], searchable: false, detailed: false }
  if (lead.length === 0) return empty
  const first = lead[0].split(':').pop()!.split(/\s[–-]\s/).pop()!.trim()
  const tokens = normalizePlaceText(first).split(' ').filter(Boolean)
  const numbers = tokens.filter((t) => /\d/.test(t))
  const nameTokens = tokens.filter((t) => !/\d/.test(t) && !GENERIC.has(t) && t.length > 1)
  const folded = normalizePlaceText(first)
  const hasMarker = tokens.some((t) => GENERIC.has(t) && t !== 'khu' && t !== 'kcn' && t !== 'ccn' && t !== 'va' && t !== 'and')
  const detailed = !KCN_START.test(folded) && (numbers.length > 0 || hasMarker)
  return { street: lead.join(', '), numbers, nameTokens, searchable: detailed && numbers.length > 0 && nameTokens.length > 0, detailed }
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


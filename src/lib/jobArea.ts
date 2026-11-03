/**
 * 공고 지역(성/시) 판정 — 모든 화면의 지역 필터가 쓰는 한 곳(Lee 2026-11-03
 * "지역명이 서로 안 맞으면 공고 올려도 안 들어갈 거 아니야").
 *
 * 기준 자료는 공식 2025-07-01 개편 후 34개 성/시(vnProvinces.ts) 하나다. 주소에
 * 옛 성 이름(Bắc Giang·Long An 등)이나 옛 군/구 이름(Quế Võ·Tiên Du 등)만 있어도
 * 공식 대응표(vnOldProvinces.ts·vnDistricts.ts, 모두 vietnam-provinces 패키지)로
 * 지금 성을 찾는다. 공고가 어떤 경로(관리자·수집·고용주)로 들어왔든 주소 글자만
 * 있으면 자동으로 판정되므로 DB에 따로 채워 둘 값이 필요 없다.
 *
 * 후보가 여러 개면(같은 군/구 이름이 여러 성에 있음 등) 하나로 단정하지 않는다.
 */
import { VN_PROVINCES } from '../data/vnProvinces'
import { VN_OLD_PROVINCE_TO_NEW } from '../data/vnOldProvinces'
import { VN_DISTRICTS_BY_PROVINCE } from '../data/vnDistricts'
import { normalizeViText } from './jobCoords'

const PROVINCE_PREFIX = /^(Tỉnh|Thành phố) /
const DISTRICT_PREFIX = /^(Quận|Huyện|Thị xã|Thành phố) /

/** "Tỉnh Bắc Ninh" → "Bắc Ninh" (화면 표시용 짧은 이름). */
export function provinceShortName(official: string): string {
  return official.replace(PROVINCE_PREFIX, '')
}

/** 공고 텍스트에서 흔히 쓰는 별칭(공식 이름에 없는 것만). */
const EXTRA_PROVINCE_ALIASES: Record<string, string[]> = {
  'Thành phố Hồ Chí Minh': ['hcm', 'tp hcm', 'tphcm', 'sai gon', 'saigon'],
}

type Alias = { alias: string; provinces: string[] }

function buildProvinceAliases(): Alias[] {
  const map = new Map<string, Set<string>>()
  const add = (alias: string, province: string) => {
    const a = normalizeViText(alias)
    if (!a) return
    if (!map.has(a)) map.set(a, new Set())
    map.get(a)!.add(province)
  }
  for (const p of VN_PROVINCES) {
    add(provinceShortName(p), p)
    for (const extra of EXTRA_PROVINCE_ALIASES[p] ?? []) add(extra, p)
  }
  for (const [oldName, news] of Object.entries(VN_OLD_PROVINCE_TO_NEW)) {
    for (const n of news) add(provinceShortName(oldName), n)
  }
  return [...map].map(([alias, set]) => ({ alias, provinces: [...set] }))
}

/** 옛 군/구 이름. 숫자 이름(Quận 1)이나 성 이름과 같은 이름(Thành phố Bắc Ninh)은
 * 앞말(quan/tp/thanh pho/huyen/thi xa)이 붙어 있을 때만 맞춘다 — "Bắc Ninh" 글자만
 * 보고 옛 Bắc Ninh 시로 단정하지 않기 위함. */
type DistrictAlias = { forms: string[]; province: string; district: string }

const DISTRICT_PREFIX_FORMS: Record<string, string[]> = {
  'Quận': ['quan', 'q'],
  'Huyện': ['huyen', 'h'],
  'Thị xã': ['thi xa', 'tx'],
  'Thành phố': ['thanh pho', 'tp'],
}

let provinceAliasCache: Alias[] | null = null
let districtAliasCache: DistrictAlias[] | null = null

function provinceAliases(): Alias[] {
  return (provinceAliasCache ??= buildProvinceAliases())
}

export function districtAliases(): DistrictAlias[] {
  if (districtAliasCache) return districtAliasCache
  const provinceNames = new Set(provinceAliases().map((a) => a.alias))
  const out: DistrictAlias[] = []
  for (const [province, districts] of Object.entries(VN_DISTRICTS_BY_PROVINCE)) {
    for (const district of districts) {
      const m = DISTRICT_PREFIX.exec(district)
      const bare = normalizeViText(district.replace(DISTRICT_PREFIX, ''))
      if (!bare) continue
      const prefixed = (m ? DISTRICT_PREFIX_FORMS[m[1]] ?? [] : []).map((f) => `${f} ${bare}`)
      const needsPrefix = /^\d+$/.test(bare) || provinceNames.has(bare)
      out.push({ forms: needsPrefix ? prefixed : [bare, ...prefixed], province, district })
    }
  }
  return (districtAliasCache = out)
}

/** 단어 경계로 포함 여부(부분 글자 오인 방지: "an" ≠ "tan an"). */
export function hasPhrase(hay: string, phrase: string): boolean {
  return phrase.length > 0 && hay.includes(` ${phrase} `)
}

export function normalizedHay(texts: (string | null | undefined)[]): string {
  return ` ${texts.map((t) => normalizeViText(t ?? '')).filter(Boolean).join(' | ')} `
}

/** 텍스트들(공고 location + 근무지 주소들)에서 지금 성/시 후보. 이름이 직접 나오면
 * 그것만, 없으면 옛 군/구 이름으로 찾는다. 찾지 못하면 빈 배열. */
export function resolveProvinces(texts: (string | null | undefined)[]): string[] {
  const hay = normalizedHay(texts)
  if (!hay.trim()) return []
  const direct = new Set<string>()
  for (const a of provinceAliases()) if (hasPhrase(hay, a.alias)) a.provinces.forEach((p) => direct.add(p))
  if (direct.size > 0) return [...direct]
  const viaDistrict = new Set<string>()
  for (const d of districtAliases()) if (d.forms.some((f) => hasPhrase(hay, f))) viaDistrict.add(d.province)
  return [...viaDistrict]
}

export interface JobAreaSource {
  location?: string | null
  workLocations?: { rawAddress?: string | null; resolvedProvince?: string | null }[]
}

/** 공고 하나의 성/시 후보(주소 판정 + DB에 이미 채워진 값이 있으면 합침). */
export function jobProvinces(job: JobAreaSource): string[] {
  const locs = job.workLocations ?? []
  const set = new Set(resolveProvinces([job.location, ...locs.map((l) => l.rawAddress)]))
  for (const l of locs) if (l.resolvedProvince && VN_PROVINCES.includes(l.resolvedProvince)) set.add(l.resolvedProvince)
  return [...set]
}

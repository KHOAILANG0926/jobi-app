// 공고 중복 기준 (Lee 2026-11-06): 글이 같은지가 아니라 "같은 회사 · 같은 일 · 같은 위치"면 사실상 중복이다.
//  - 회사 = 핵심 이름(회사 형태·가게 종류·지역·지점 낱말을 뺀 이름) + 업종(가게 종류 소분류). 이름이 같아도 업종이 다르면 다른 회사
//    (카페와 식당은 따로 — 사이트 소분류 Quán cà phê / Nhà hàng). 업종은 가게 종류로만 나누고 하는 일(서빙·요리)로는 나누지 않는다.
//    한쪽에 회사 이름이 없으면 전화·Zalo 번호로 같은 회사를 본다. 양쪽 이름이 있는데 다르면 번호가 같아도 다른 회사(인력업체 번호 공유).
//  - 하는 일 = 공식 직업분류 코드. 둘 다 세부(4자리 이상)면 같아야 하고, 한쪽이라도 큰 분류뿐이면 첫 자리만 비교.
//  - 위치 = 정확한 핀(번지·공단 정문)끼리 200m 안, 또는 같은 공단 이름. 한쪽이라도 대략 위치뿐이면 "판단 불가"(묶지 않고 확인 목록).
// 이 파일은 계산만 한다(읽기 전용). 등록 입구·DB 규칙 변경은 별도 단계(승인 필요).
import { VN_PROVINCES } from '../data/vnProvinces'
import { VN_DISTRICTS_BY_PROVINCE } from '../data/vnDistricts'

export function fold(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

// 회사 형태
const LEGAL = ['cong ty', 'cty', 'ct', 'tnhh', 'mtv', 'co phan', 'cp', 'jsc', 'co ltd', 'co., ltd', 'ltd', 'limited', 'corporation', 'corp', 'group', 'tap doan', 'tong cong ty', 'doanh nghiep', 'dntn', 'hkd', 'ho kinh doanh']
// 지점 표시
const BRANCH = ['chi nhanh', 'co so', 'cn', 'cs', 'van phong dai dien', 'vpdd']
// 가게 종류 낱말 → 업종(사이트 소분류 키). 이름에서는 빼고 업종으로 쓴다.
const KIND_WORDS: Array<[string, string]> = [
  ['tra sua', 'quan_ca_phe'], ['ca phe', 'quan_ca_phe'], ['cafe', 'quan_ca_phe'], ['coffee', 'quan_ca_phe'], ['cofe', 'quan_ca_phe'],
  ['nha hang', 'nha_hang'], ['lau', 'nha_hang'], ['nuong', 'nha_hang'], ['buffet', 'nha_hang'], ['restaurant', 'nha_hang'], ['bbq', 'nha_hang'],
  ['quan an', 'quan_an_binh_dan'], ['com', 'quan_an_binh_dan'], ['pho', 'quan_an_binh_dan'], ['bun', 'quan_an_binh_dan'],
  ['ga ran', 'ga_ran_pizza'], ['pizza', 'ga_ran_pizza'], ['tiem banh', 'tiem_banh'], ['bakery', 'tiem_banh'], ['banh mi', 'tiem_banh'],
  ['quan bia', 'quan_bia'], ['quan nhau', 'quan_bia'], ['bia hoi', 'quan_bia'], ['bar', 'bar'], ['pub', 'bar'],
  ['karaoke', 'karaoke'], ['spa', 'sauna_spa'], ['gym', 'gym_the_thao'], ['khach san', 'khach_san_resort'], ['hotel', 'khach_san_resort'], ['resort', 'khach_san_resort'],
  ['sieu thi', 'sieu_thi'], ['mart', 'sieu_thi'], ['tap hoa', 'cua_hang_tien_loi'], ['cua hang', 'cua_hang'], ['shop', 'cua_hang'], ['tiem', 'cua_hang'], ['quan', 'quan'],
  ['bat dong san', 'bat_dong_san'], ['bds', 'bat_dong_san'], ['nha khoa', 'nha_khoa'], ['nail', 'toc_lam_dep_nail'], ['salon', 'toc_lam_dep_nail'],
]
// 사이트 소분류 중 "가게 종류"인 것만 업종으로 쓴다(서빙·요리사·바리스타처럼 하는 일 소분류는 쓰지 않음).
const KIND_SUBCATEGORIES = new Set([
  'quan_an_binh_dan', 'nha_hang', 'nha_hang_gia_dinh', 'thuc_an_nhanh', 'ga_ran_pizza', 'quan_ca_phe', 'kem_trang_mieng', 'tiem_banh', 'quan_bia', 'bar',
  'suat_an_cong_nghiep', 'com_hop', 'ttm_tm', 'sieu_thi', 'cho_truyen_thong', 'cua_hang_tien_loi', 'quan_ao_trang_suc', 'my_pham_suc_khoe', 'dien_thoai_thiet_bi',
  'noi_that', 'do_gia_dung', 'nha_sach_van_phong_pham', 'nong_san_thuy_san', 'cua_hang_hoa', 'quan_net', 'karaoke', 'bowling_billiard', 'ca_phe_chu_de',
  'ca_phe_tre_em', 'sauna_spa', 'gym_the_thao', 'khach_san_resort', 'cong_vien_giai_tri', 'rap_chieu_phim', 'cay_xang_rua_xe', 'toc_lam_dep_nail', 'cham_soc_da_massage',
])
const ADMIN_PREFIX = /^(thanh pho|tinh|thi xa|thi tran|huyen|quan|phuong|xa)\s+/
const PLACES: string[] = (() => {
  const out = new Set<string>(['viet nam', 'vietnam', 'vn', 'ha noi', 'hn', 'hcm', 'tp hcm', 'sai gon', 'bac ninh', 'bac giang'])
  const add = (n: string) => { const f = fold(n).replace(ADMIN_PREFIX, '').trim(); if (f.length >= 3) out.add(f) }
  for (const p of VN_PROVINCES) add(p)
  for (const ds of Object.values(VN_DISTRICTS_BY_PROVINCE)) for (const d of ds) add(d)
  return [...out].sort((a, b) => b.length - a.length)
})()

const word = (w: string) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?=$|[^a-z0-9])`, 'g')

/** 회사 이름에서 핵심 이름과 이름에 붙은 가게 종류를 뽑는다. 예: "Lẩu Haidilao Bắc Ninh" → { core: 'haidilao', kind: 'nha_hang' } */
export function companyCore(name: string | null | undefined): { core: string; kind: string | null } {
  let s = ' ' + fold(name).replace(/[()[\]"'“”.,&/\\|–—-]/g, ' ') + ' '
  let kind: string | null = null
  for (const [w, k] of KIND_WORDS) { const re = word(w); if (re.test(s)) { if (!kind || kind === 'cua_hang' || kind === 'quan') kind = k; s = s.replace(word(w), ' ') } }
  for (const w of [...LEGAL, ...BRANCH]) s = s.replace(word(w), ' ')
  for (const p of PLACES) s = s.replace(word(p), ' ')
  const core = s.replace(/[^a-z0-9]/g, '')
  return { core, kind }
}

/** 업종: 이름의 가게 종류 낱말 → 가게 종류 소분류 → 큰 분류. */
export function businessKind(job: { company?: string | null; subcategory?: string | null; category?: string | null }): string {
  const fromName = companyCore(job.company).kind
  if (fromName && fromName !== 'cua_hang' && fromName !== 'quan') return fromName
  if (job.subcategory && KIND_SUBCATEGORIES.has(job.subcategory)) return job.subcategory
  return fromName ?? job.category ?? ''
}

export function phoneKeys(...values: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const v of values) for (const m of String(v ?? '').matchAll(/(?:\+?84|0)[\s.\-]?\d(?:[\s.\-]?\d){7,9}/g)) {
    let d = m[0].replace(/\D/g, '')
    if (d.startsWith('84')) d = '0' + d.slice(2)
    if (d.length >= 9 && d.length <= 11) out.add(d)
  }
  return [...out]
}

export interface IdentityJob {
  id: number; title?: string | null; company?: string | null; category?: string | null; subcategory?: string | null
  occupation_code?: string | null; employer_phone?: string | null; contact_zalo?: string | null
  points?: Array<{ lat?: number | null; lng?: number | null; point_kind?: string | null; industrial_park?: string | null }>
}

export function sameCompany(a: IdentityJob, b: IdentityJob): boolean {
  const ca = companyCore(a.company).core, cb = companyCore(b.company).core
  if (ca && cb) return ca === cb && businessKind(a) === businessKind(b)
  const pa = phoneKeys(a.employer_phone, a.contact_zalo), pb = new Set(phoneKeys(b.employer_phone, b.contact_zalo))
  return pa.some((p) => pb.has(p))
}

export function sameJob(a: IdentityJob, b: IdentityJob): boolean {
  const x = String(a.occupation_code ?? '').trim(), y = String(b.occupation_code ?? '').trim()
  if (!x || !y) return false
  if (x.length >= 4 && y.length >= 4) return x === y
  return x[0] === y[0]
}

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

export const SAME_PLACE_M = 200
/** 'same' | 'different' | 'unknown'(한쪽이라도 대략 위치뿐 — 묶지 않고 확인 목록). */
export function sameLocation(a: IdentityJob, b: IdentityJob): 'same' | 'different' | 'unknown' {
  const precise = (j: IdentityJob) => (j.points ?? []).filter((p) => (p.point_kind === 'exact' || p.point_kind === 'gate') && p.lat != null && p.lng != null)
  const parks = (j: IdentityJob) => new Set((j.points ?? []).map((p) => fold(p.industrial_park).trim()).filter(Boolean))
  const pa = parks(a), pb = parks(b)
  if ([...pa].some((k) => pb.has(k))) return 'same'
  const xa = precise(a), xb = precise(b)
  if (!xa.length || !xb.length) return 'unknown'
  return xa.some((p) => xb.some((q) => meters(p as { lat: number; lng: number }, q as { lat: number; lng: number }) <= SAME_PLACE_M)) ? 'same' : 'different'
}

/** 같은 회사·같은 일인 공고 묶음을 위치 판정과 함께 돌려준다. */
export function duplicateGroups(jobs: IdentityJob[]): { duplicates: number[][]; unknownLocation: number[][] } {
  const parent = new Map<number, number>()
  const find = (x: number): number => { const p = parent.get(x) ?? x; if (p === x) return x; const r = find(p); parent.set(x, r); return r }
  const unknownPairs: Array<[number, number]> = []
  for (let i = 0; i < jobs.length; i++) for (let k = i + 1; k < jobs.length; k++) {
    const a = jobs[i], b = jobs[k]
    if (!sameCompany(a, b) || !sameJob(a, b)) continue
    const loc = sameLocation(a, b)
    if (loc === 'same') parent.set(find(a.id), find(b.id))
    else if (loc === 'unknown') unknownPairs.push([a.id, b.id])
  }
  const groups = new Map<number, number[]>()
  for (const j of jobs) { const r = find(j.id); groups.set(r, [...(groups.get(r) ?? []), j.id]) }
  const duplicates = [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((x, y) => x - y))
  const inDup = new Set(duplicates.flat())
  const unknownLocation = unknownPairs.filter(([x, y]) => !(inDup.has(x) && inDup.has(y) && find(x) === find(y))).map((p) => p.sort((x, y) => x - y))
  return { duplicates, unknownLocation }
}

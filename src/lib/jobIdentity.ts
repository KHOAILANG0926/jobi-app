// 공고 중복 기준 (Lee 2026-11-06): 글이 같은지가 아니라 "같은 회사 · 같은 일 · 같은 위치"면 사실상 중복이다.
//  - 회사 = 핵심 이름(회사 형태·가게 종류를 빼고, 지역·지점명은 지점 칸으로 뗀 이름) + 업종(가게 종류 소분류). 지점은 따로(지점명·위치). 이름이 같아도 업종이 다르면 다른 회사
//    (카페와 식당은 따로 — 사이트 소분류 Quán cà phê / Nhà hàng). 업종은 가게 종류로만 나누고 하는 일(서빙·요리)로는 나누지 않는다.
//    한쪽에 회사 이름이 없으면 전화·Zalo 번호로 같은 회사를 본다. 양쪽 이름이 있는데 다르면 번호가 같아도 다른 회사(인력업체 번호 공유).
//  - 하는 일 = 공식 직업분류 코드. 둘 다 세부(4자리 이상)면 같아야 하고, 한쪽이라도 큰 분류뿐이면 첫 자리만 비교.
//  - 위치 = 정확한 핀(번지·공단 정문)끼리 200m 안, 또는 같은 공단 이름. 한쪽이라도 대략 위치뿐이면 "판단 불가"(묶지 않고 확인 목록).
// 이 파일은 계산만 한다(읽기 전용). 등록 입구·DB 규칙 변경은 별도 단계(승인 필요).
import { VN_PROVINCES } from '../data/vnProvinces'
import { VN_DISTRICTS_BY_PROVINCE } from '../data/vnDistricts'
import { VN_WARDS_BY_PROVINCE } from '../data/vnWards'
import { VN_OLD_WARDS_BY_PROVINCE } from '../data/vnOldWards'
import { SUBCATEGORY_LABELS } from '../data/subcategories'

export function fold(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

// 회사 형태
const LEGAL = ['cong ty', 'cty', 'ct', 'tnhh', 'mtv', 'co phan', 'cp', 'jsc', 'co ltd', 'co., ltd', 'ltd', 'limited', 'corporation', 'corp', 'group', 'tap doan', 'tong cong ty', 'doanh nghiep', 'dntn', 'hkd', 'ho kinh doanh']
// 가게 종류 낱말 → 업종(사이트 소분류 키). 이름에서는 빼고 업종으로 쓴다.
// 성조를 지우지 않고 원래 글자로 찾는다(Lee 2026-11-06): Phở≠Phố, Quán≠Quận, Lẩu≠Lâu, Cơm≠Còm, Bún≠Bùn.
const KIND_WORDS: Array<[string, string]> = [
  ['trà sữa', 'quan_ca_phe'], ['cà phê', 'quan_ca_phe'], ['café', 'quan_ca_phe'], ['cafe', 'quan_ca_phe'], ['coffee', 'quan_ca_phe'], ['cofe', 'quan_ca_phe'],
  ['nhà hàng', 'nha_hang'], ['lẩu', 'nha_hang'], ['nướng', 'nha_hang'], ['buffet', 'nha_hang'], ['restaurant', 'nha_hang'], ['bbq', 'nha_hang'],
  ['quán ăn', 'quan_an_binh_dan'], ['cơm', 'quan_an_binh_dan'], ['phở', 'quan_an_binh_dan'], ['bún', 'quan_an_binh_dan'],
  ['gà rán', 'ga_ran_pizza'], ['pizza', 'ga_ran_pizza'], ['tiệm bánh', 'tiem_banh'], ['bakery', 'tiem_banh'], ['bánh mì', 'tiem_banh'],
  ['quán bia', 'quan_bia'], ['quán nhậu', 'quan_bia'], ['bia hơi', 'quan_bia'], ['bar', 'bar'], ['pub', 'bar'],
  ['karaoke', 'karaoke'], ['spa', 'sauna_spa'], ['gym', 'gym_the_thao'], ['khách sạn', 'khach_san_resort'], ['hotel', 'khach_san_resort'], ['resort', 'khach_san_resort'],
  ['siêu thị', 'sieu_thi'], ['mart', 'sieu_thi'], ['tạp hóa', 'cua_hang_tien_loi'], ['tạp hoá', 'cua_hang_tien_loi'], ['cửa hàng', 'cua_hang'], ['shop', 'cua_hang'], ['tiệm', 'cua_hang'], ['quán', 'quan'],
  ['bất động sản', 'bat_dong_san'], ['bđs', 'bat_dong_san'], ['nha khoa', 'nha_khoa'], ['nail', 'toc_lam_dep_nail'], ['salon', 'toc_lam_dep_nail'],
]
// 성조 없이 쓴 이름("Nha hang ABC")은 지운 글자로 찾되, 지우면 다른 낱말과 같아지는 것은 쓰지 않는다.
const AMBIGUOUS_WITHOUT_TONES = new Set(['pho', 'quan', 'lau', 'com', 'bun', 'tiem', 'quan an', 'quan bia', 'quan nhau'])
// 사이트 소분류 중 "가게 종류"인 것만 업종으로 쓴다(서빙·요리사·바리스타처럼 하는 일 소분류는 쓰지 않음).
const KIND_SUBCATEGORIES = new Set([
  'quan_an_binh_dan', 'nha_hang', 'nha_hang_gia_dinh', 'thuc_an_nhanh', 'ga_ran_pizza', 'quan_ca_phe', 'kem_trang_mieng', 'tiem_banh', 'quan_bia', 'bar',
  'suat_an_cong_nghiep', 'com_hop', 'ttm_tm', 'sieu_thi', 'cho_truyen_thong', 'cua_hang_tien_loi', 'quan_ao_trang_suc', 'my_pham_suc_khoe', 'dien_thoai_thiet_bi',
  'noi_that', 'do_gia_dung', 'nha_sach_van_phong_pham', 'nong_san_thuy_san', 'cua_hang_hoa', 'quan_net', 'karaoke', 'bowling_billiard', 'ca_phe_chu_de',
  'ca_phe_tre_em', 'sauna_spa', 'gym_the_thao', 'khach_san_resort', 'cong_vien_giai_tri', 'rap_chieu_phim', 'cay_xang_rua_xe', 'toc_lam_dep_nail', 'cham_soc_da_massage',
])
const ADMIN_PREFIX = /^(thanh pho|tinh|thi xa|thi tran|huyen|quan|phuong|xa|dac khu)\s+/
const toks = (s: string) => s.split(/\s+/).filter(Boolean)
// 지역 이름(성·군·동) — 회사 이름에서 떼어 지점 칸으로 옮긴다(Lee 2026-11-06: 회사는 따로, 지점은 따로).
const PLACES: string[][] = (() => {
  const out = new Set<string>(['viet nam', 'vietnam', 'vn', 'ha noi', 'hn', 'hcm', 'tp hcm', 'sai gon', 'bac ninh', 'bac giang', 'kinh bac'])
  const add = (n: string) => { const f = fold(n).replace(ADMIN_PREFIX, '').replace(/\s+/g, ' ').trim(); if (f.length >= 3) out.add(f) }
  for (const p of VN_PROVINCES) add(p)
  for (const ds of Object.values(VN_DISTRICTS_BY_PROVINCE)) for (const d of ds) add(d)
  for (const ws of Object.values(VN_WARDS_BY_PROVINCE)) for (const w of ws) add(w)
  for (const ws of Object.values(VN_OLD_WARDS_BY_PROVINCE)) for (const [w, d] of ws) { add(w); add(d) }   // 옛 동·군(2025-07 이전) — 공고 글은 옛 이름을 많이 씀
  return [...out].map(toks).sort((x, y) => y.length - x.length)
})()
const LEGAL_T = LEGAL.map((w) => toks(w.replace(/[.,]/g, ' '))).sort((x, y) => y.length - x.length)
const lowerVi = (x: string | null | undefined) => String(x ?? '').normalize('NFC').toLowerCase()
const KIND_TONED = KIND_WORDS.map(([w, k]) => [toks(lowerVi(w)), k] as [string[], string]).sort((x, y) => y[0].length - x[0].length)
const KIND_PLAIN = KIND_WORDS.map(([w, k]) => [toks(fold(w)), k] as [string[], string])
  .filter(([ph]) => !AMBIGUOUS_WITHOUT_TONES.has(ph.join(' '))).sort((x, y) => y[0].length - x[0].length)
const at = (t: string[], i: number, ph: string[]) => ph.every((w, k) => t[i + k] === w)
const BRANCH_MARK = [['chi', 'nhanh'], ['co', 'so'], ['cn'], ['cs'], ['van', 'phong', 'dai', 'dien'], ['vpdd']]

/**
 * 회사 이름 → 핵심 이름(회사) · 가게 종류(업종) · 지점명(지점 칸).
 *  예: "Highlands Coffee Mường Thanh Bắc Ninh" → { core: 'highlands', kind: 'quan_ca_phe', branch: 'muong thanh bac ninh' }
 *  - "-", "–", "|", "(", "Chi nhánh", "Cơ sở", "CN", "CS" 뒤는 지점명.
 *  - 이름 뒤에 붙은 가게 종류 낱말 다음은 지점명("Highlands Coffee | Mường Thanh"). 앞에 붙으면 뒤가 이름("Nhà hàng | Thanh Phệ").
 *  - 가게 종류 낱말은 성조 그대로 찾는다. 이름 전체에 성조가 없을 때만 지운 글자로 찾고, 그때도 헷갈리는 낱말(phở/phố 등)은 안 쓴다.
 *  - 이름 끝에 붙은 성·군·동 이름은 지점명으로 옮긴다(가운데·앞은 회사 이름 일부라 둔다, 핵심이 비면 안 됨).
 */
export function companyCore(name: string | null | undefined): { core: string; kind: string | null; branch: string } {
  const lower = lowerVi(name).replace(/[–—|()]/g, ' $& ')
  let tTone = toks(lower.replace(/[[\]"'“”.,&/\\:]/g, ' '))
  const toned = fold(lower) !== lower.replace(/đ/g, 'd')            // 성조·đ가 하나라도 있으면 원래 글자로 찾는다
  const branchParts: string[] = []
  // 지점 구분자
  let tPlain = tTone.map(fold)
  const cut = tPlain.findIndex((w, i) => i > 0 && (/^[-–—|(]$/.test(w) || BRANCH_MARK.some((ph) => at(tPlain, i, ph))))
  if (cut > 0) { branchParts.push(tPlain.slice(cut).join(' ')); tTone = tTone.slice(0, cut); tPlain = tPlain.slice(0, cut) }
  // 회사 형태 빼기
  const legal = tPlain.map((_, i, arr) => LEGAL_T.some((ph) => ph.some((__, k) => i - k >= 0 && at(arr, i - k, ph))))
  tTone = tTone.filter((_, i) => !legal[i]); tPlain = tPlain.filter((_, i) => !legal[i])
  // 가게 종류
  const kinds = toned ? KIND_TONED : KIND_PLAIN
  const look = toned ? tTone : tPlain
  let kind: string | null = null
  const kept: string[] = []
  for (let i = 0; i < look.length; ) {
    const hit = kinds.find(([ph]) => at(look, i, ph))
    if (hit) {
      if (!kind || kind === 'cua_hang' || kind === 'quan') kind = hit[1]
      i += hit[0].length
      if (kept.length && i < look.length) { branchParts.push(tPlain.slice(i).join(' ')); break }   // 이름 뒤 가게 종류 → 나머지는 지점명
      continue
    }
    kept.push(tPlain[i]); i++
  }
  // 지역 이름 → 지점명: 이름 끝에 붙은 것만 뗀다(예: "Wallace Bắc Ninh"). 흔한 동 이름("Thanh", "Bảo An", "Trung Nguyên")이
  // 이름 가운데·앞에 있으면 회사 이름 일부라 그대로 둔다. 이름이 지역 이름뿐이면 비우지 않는다.
  const nameToks = [...kept]; const tail: string[] = []
  for (;;) {
    const ph = PLACES.find((p) => p.length < nameToks.length && at(nameToks, nameToks.length - p.length, p))
    if (!ph) break
    tail.unshift(ph.join(' ')); nameToks.splice(nameToks.length - ph.length)
  }
  if (tail.length) branchParts.unshift(tail.join(' '))
  const branch = branchParts.join(' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  return { core: nameToks.join('').replace(/[^a-z0-9]/g, ''), kind, branch }
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

// 소분류 → 큰 분류
const SUB_TO_CAT: Record<string, string> = Object.fromEntries(Object.entries(SUBCATEGORY_LABELS).flatMap(([cat, subs]) => Object.keys(subs ?? {}).map((k) => [k, cat])))
const CATEGORIES = new Set(Object.keys(SUBCATEGORY_LABELS))
/**
 * 업종이 서로 맞는지 (Lee 2026-11-06). 같은 회사가 공고마다 다른 업종으로 잡히는 걸 막는다.
 *  - 큰 분류("음식·음료")와 그 아래 소분류("카페")는 맞음. 소분류끼리 다르면(카페 ≠ 식당) 다른 회사.
 *  - "가게"·"quán"처럼 종류가 흐린 낱말, 업종 없음은 무엇과도 맞음.
 *  - 이름 낱말에서 나온 소분류 밖 업종(부동산·치과 등)은 어느 큰 분류와도 맞고, 다른 구체 업종과만 다름.
 */
export function kindsCompatible(a: string, b: string): boolean {
  if (a === b || !a || !b) return true
  const vague = (k: string) => k === 'cua_hang' || k === 'quan'
  if (vague(a) || vague(b)) return true
  const catA = CATEGORIES.has(a), catB = CATEGORIES.has(b)
  if (catA && catB) return false
  if (catA) return !SUB_TO_CAT[b] || SUB_TO_CAT[b] === a
  if (catB) return !SUB_TO_CAT[a] || SUB_TO_CAT[a] === b
  return false
}

export function sameCompany(a: IdentityJob, b: IdentityJob): boolean {
  const ca = companyCore(a.company).core, cb = companyCore(b.company).core
  if (ca && cb) return ca === cb && kindsCompatible(businessKind(a), businessKind(b))
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

/**
 * 화면 대조 검사(#646, Lee 2026-11-10 — sb-5876 화면 오류 3건이 검사표를 통과한 채 공개됨).
 * 운영 화면에 실제로 보이는 것(상단 제목·회사 줄·길찾기 버튼·지도 핀·전화·Zalo·복리후생 아이콘·급여)을
 * 원문(source_text·ocr_text)·DB 값과 대조한다. 계획: docs/plans/2026-11-10-screen-audit.md(Codex 의견 반영).
 * - sure: 확정 오류 → 공개하지 않는다.
 * - unsure: 판정 불명확 → 공개는 막지 않고 목록으로만 알린다(승인된 표시 변환·포스터 글자 등 사람이 봐야 하는 것).
 * 특정 회사·공고 번호 분기 없음. 순수 함수(브라우저 수집은 scripts/ops/screen-audit.mjs).
 */
import { companyLine, companyLineBroken, detailTitle } from './companyBranch.ts'
import { sourceLines, hasPayAmount, timeRanges, promoLike } from './inspectReading.ts'

export type ScreenView = {
  device: string
  title: string
  company?: string | null
  /** 화면의 Google 지도·길찾기 링크 href 전부 */
  mapLinks: string[]
  /** 화면 지도 핀 "lat,lng" (.jd2-vmap data-planned-location-points) */
  pins: string[]
  tel: string[]
  zalo: string[]
  /** 켜진 복리후생 아이콘 key(BENEFIT_ORDER) */
  benefits: string[]
  salary?: string | null
  /** 승인된 4영역(10-30 확정)의 화면 글자: ① Điều kiện làm việc ② Thông tin tuyển dụng ③ Khu vực làm việc ④ Mô tả công việc. 못 읽으면 없음 */
  areas?: Partial<Record<'①' | '②' | '③' | '④', string>>
}
export type ScreenJob = {
  id: number
  title: string
  company?: string | null
  source_text?: string | null
  ocr_text?: string | null
  employer_phone?: string | null
  /** 공식 직업분류 코드(최상위 5 = 서비스·판매) */
  occupation_code?: string | null
  contact_zalo?: string | null
  /** 근무지 1곳일 때 Google이 회사 이름으로 찾은 장소 좌표(핀 출처 Google) */
  googlePin?: { lat: number; lng: number } | null
  /** /api/map-locations가 돌려준 핀 "lat,lng" */
  apiPins?: string[] | null
}
export type ScreenFinding = { key: string; sure: boolean; device: string; detail: string }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const parsePoint = (s: string) => {
  const m = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(s)
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null
}
/** 두 점 거리(m) */
export function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6371000
}
const NEAR = 100
/** 링크의 목적지/검색 좌표(글자 검색이면 null) */
export function linkPoint(href: string) {
  try {
    const u = new URL(href)
    const v = u.searchParams.get('destination') ?? u.searchParams.get('query') ?? u.searchParams.get('q') ?? ''
    return parsePoint(v) ?? (/@(-?\d+\.\d+),(-?\d+\.\d+)/.test(u.pathname) ? parsePoint(u.pathname.replace('@', '')) : null)
  } catch { return null }
}
/** 베트남 전화 숫자 맞춤: +84/84 → 0 */
export function phoneDigits(s: string) {
  const d = String(s).replace(/\D/g, '')
  return d.startsWith('84') && d.length >= 11 ? '0' + d.slice(2) : d
}
function sourcePhones(text: string) {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:\+?84|0)[\d\s.\-]{8,14}\d/g)) { const d = phoneDigits(m[0]); if (d.length >= 9 && d.length <= 11) out.add(d) }
  return out
}
/** 복리후생 아이콘 근거 낱말(원문·포스터 글자, 악센트 무시). 화면 판정식과 같은 뜻의 넓은 낱말 — 없으면 '불명확'. */
const BENEFIT_EVIDENCE: Record<string, RegExp> = {
  bus: /xe (?:dua don|dua rude|bus|buyt|cong ty)|dua don|xe dua|shuttle/,
  dorm: /ky tuc|ktx|cho o|nha o mien phi|bo tri (?:cho|nha) o|phong o/,
  meal: /\ban\b|com |bua|suat an|tien an|ho tro an|bao an|ca an/,
  attendance: /chuyen can/,
  housing: /nha o|tien nha|nha tro/,
  fuel: /xang/,
  performance: /nang suat|san luong/,
}
/** 상단 복리후생 아이콘 순서 — src/pages/JobDetail.tsx benefitIcons와 같은 순서(화면 대조 수집기가 n번째 아이콘을 이 키로 읽음). */
export const BENEFIT_ORDER = ['bus', 'dorm', 'meal', 'attendance', 'housing', 'fuel', 'performance'] as const
const BENEFIT_LABEL: Record<string, string> = { bus: 'Xe đưa đón', dorm: 'Ký túc xá', meal: 'Bữa ăn', attendance: 'Chuyên cần', housing: 'Nhà ở', fuel: 'Xăng xe', performance: 'Năng suất' }

/** 금액(VND) 목록: "8.000.000", "8 triệu", "8tr5", "8,5 triệu", "8-10 triệu" */
export function amounts(text: string) {
  const out = new Set<number>()
  const t = fold(text)
  for (const m of t.matchAll(/(\d{1,3}(?:[.,]\d{3}){1,3})(?!\d)/g)) out.add(Number(m[1].replace(/[.,]/g, '')))
  for (const m of t.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*(?:-|–|den|~)\s*(\d{1,3}(?:[.,]\d{1,2})?))?\s*(?:trieu|tr\b|tr(\d))/g)) {
    const one = (s: string) => Math.round(Number(s.replace(',', '.')) * 1_000_000)
    if (m[3]) out.add(Number(m[1]) * 1_000_000 + Number(m[3]) * (m[3].length === 1 ? 100_000 : 10_000))
    else out.add(one(m[1]))
    if (m[2]) out.add(one(m[2]))
  }
  for (const m of t.matchAll(/(\d{2,4})\s*k\b/g)) out.add(Number(m[1]) * 1000)
  return [...out].filter((n) => n >= 100_000)
}

export function screenAudit(job: ScreenJob, views: ScreenView[]): ScreenFinding[] {
  const out: ScreenFinding[] = []
  const add = (key: string, sure: boolean, device: string, detail: string) => out.push({ key, sure, device, detail })
  const source = `${job.source_text ?? ''}\n${job.ocr_text ?? ''}`
  const srcFold = fold(source)
  const hasSource = source.trim().length > 20
  const phones = sourcePhones(source)
  for (const p of [job.employer_phone, job.contact_zalo]) if (p) { const d = phoneDigits(p); if (d.length >= 9) phones.add(d) }
  const srcAmounts = new Set(amounts(source))
  const wantTitle = detailTitle(job.title, job.company)
  const wantCompany = companyLine(wantTitle, job.company)
  for (const v of views) {
    const d = v.device
    // ① 상단 제목
    const title = (v.title ?? '').trim()
    if (!title) add('title', true, d, '제목이 비어 있음')
    else {
      if (/^[\-–—:|·,.;/\\]/u.test(title)) add('title', true, d, `제목이 기호로 시작: "${title.slice(0, 40)}"`)
      if (title !== wantTitle.trim()) add('title', true, d, `제목이 계산 값과 다름: 화면 "${title.slice(0, 40)}" / 계산 "${wantTitle.slice(0, 40)}"`)
    }
    // ② 회사 줄
    const company = (v.company ?? '').trim()
    if (companyLineBroken(wantTitle, job.company)) add('company', true, d, `회사 줄이 회사명 중간부터: "${wantCompany}" (회사 "${job.company}")`)
    if (company && job.company && !fold(job.company).includes(fold(company))) add('company', true, d, `회사 줄 "${company}"이 회사명 "${job.company}"에 없음`)
    if ((wantCompany ?? '') !== company) add('company', true, d, `회사 줄이 계산 값과 다름: 화면 "${company || '(없음)'}" / 계산 "${wantCompany ?? '(없음)'}"`)
    // ③ 길찾기 버튼 = 지도 핀
    const pins = v.pins.map(parsePoint).filter((p): p is { lat: number; lng: number } => !!p)
    for (const href of v.mapLinks) {
      const p = linkPoint(href)
      if (p && pins.length && !pins.some((q) => meters(p, q) <= NEAR)) add('directions', true, d, `Google 버튼 좌표 ${p.lat},${p.lng}이 지도 핀과 다름(핀 ${v.pins.join(' / ')})`)
    }
    if (job.googlePin) {
      const g = job.googlePin
      if (!v.mapLinks.some((h) => { const p = linkPoint(h); return !!p && meters(p, g) <= NEAR })) add('directions', true, d, `핀이 Google 장소(${g.lat},${g.lng})인데 Google 버튼이 그 좌표가 아님`)
      if (pins.length && !pins.some((q) => meters(q, g) <= NEAR)) add('pin', true, d, `지도 핀이 Google 장소 좌표(${g.lat},${g.lng})와 다름`)
    }
    // apiPins: null/undefined = 지도 목록을 못 읽음(대조 생략), 배열(빈 배열 포함) = 읽음 → 양방향 대조
    const api = (job.apiPins ?? []).map(parsePoint).filter((p): p is { lat: number; lng: number } => !!p)
    if (job.apiPins && (!pins.every((q) => api.some((a) => meters(q, a) <= NEAR)) || !api.every((a) => pins.some((q) => meters(q, a) <= NEAR)))) add('pin', true, d, `상세 핀(${v.pins.join(' / ')})이 지도 목록 핀(${(job.apiPins ?? []).join(' / ')})과 다름`)
    // ④ 연락처
    for (const t of v.tel) { const n = phoneDigits(t); if (n.length >= 9 && !phones.has(n)) add('phone', hasSource, d, `화면 전화 ${t}가 원문·DB에 없음`) }
    for (const z of v.zalo) { const n = phoneDigits(z); if (n.length >= 9 && !phones.has(n)) add('zalo', hasSource, d, `화면 Zalo ${z}가 원문·DB에 없음`) }
    // ⑤ 복리후생 아이콘: 원문 근거 낱말이 없으면 판정 불명확(포스터 그림·다른 표현일 수 있음)
    for (const k of v.benefits) {
      const re = BENEFIT_EVIDENCE[k]
      if (re && !re.test(srcFold)) add('benefit', false, d, `아이콘 "${BENEFIT_LABEL[k] ?? k}" 켜짐 — 원문에서 근거 낱말 못 찾음`)
    }
    // ⑥ 급여: 화면 금액이 원문 금액에 없으면 판정 불명확(승인된 표시 변환 있음)
    const shown = amounts(v.salary ?? '')
    if (hasSource && shown.length) {
      const miss = shown.filter((n) => !srcAmounts.has(n))
      if (miss.length) add('salary', false, d, `화면 급여 "${String(v.salary).slice(0, 60)}"의 ${miss.map((n) => n.toLocaleString('vi-VN')).join(', ')}이 원문 금액에 없음`)
    }
    // ⑦ 항목이 맞는 영역에 나오는가(운영 공고 전체용 독립 판정 — 원문 줄의 종류를 글자 모양으로만 읽는다, R2 #753)
    for (const f of areaFindings(job, source, v)) add(f.key, f.sure, d, f.detail)
    // ⑧ 업종: 공단·공장 글인데 서비스·판매(5)로 분류됐나 — 원문 업무로 사람이 봐야 하므로 판정 불명확
    if (/^5/.test(String(job.occupation_code ?? '')) && FACTORY_WORDS.test(srcFold) && !SHOP_WORDS.test(srcFold)) add('industry', false, d, `업종 코드 ${job.occupation_code}(서비스·판매)인데 원문은 공단·공장 글(가게 낱말 없음)`)
  }
  // 같은 내용이 PC·모바일 둘 다 나오면 한 줄로
  const seen = new Map<string, ScreenFinding>()
  for (const f of out) {
    const k = `${f.key}|${f.sure}|${f.detail}`
    const prev = seen.get(k)
    if (prev) { if (!prev.device.includes(f.device)) prev.device += '·' + f.device } else seen.set(k, { ...f })
  }
  return [...seen.values()]
}

const FACTORY_WORDS = /\b(?:kcn|khu cong nghiep|vsip|nha may|cong nhan|xuong san xuat|lap rap)\b/
const SHOP_WORDS = /\b(?:cua hang|quan an|nha hang|ca phe|cafe|coffee|tap hoa|sieu thi|shop|phuc vu|thu ngan|ban hang|bep)\b/
const AREA_TITLE: Record<'①' | '②' | '③' | '④', string> = { '①': 'Điều kiện làm việc', '②': 'Thông tin tuyển dụng', '③': 'Khu vực làm việc', '④': 'Mô tả công việc' }

/**
 * 원문 줄의 종류를 글자 모양으로 읽어(연락처·모집 조건·급여·근무시간), 그 줄이 나와선 안 되는 영역에 나오면 확정 오류.
 * 허용 영역은 10-30 확정 구성: 연락처 → ④ / 모집 조건 → ② 또는 ④(원문 보존) / 급여·근무시간 → ① 또는 ④.
 * 영역을 못 읽으면 통과가 아니라 '미검증'(불명확)으로 남긴다. 연락처 번호가 ④에 하나도 없으면 빠짐 의심(불명확).
 */
export function areaFindings(job: ScreenJob, source: string, view: ScreenView): ScreenFinding[] {
  const out: ScreenFinding[] = []
  const d = view.device
  const areas = view.areas
  const keys = Object.keys(AREA_TITLE) as Array<keyof typeof AREA_TITLE>
  if (!areas) return []   // 수집기가 영역을 모으지 않은 호출(이전 호출자)은 대조 생략
  if (!keys.some((k) => (areas[k] ?? '').trim())) return [{ key: 'areas', sure: false, device: d, detail: '화면의 4영역 글자를 읽지 못함 — 배치 미검증' }]
  const missing = keys.filter((k) => !(areas[k] ?? '').trim()).filter((k) => k === '④')
  if (missing.length) out.push({ key: 'areas', sure: false, device: d, detail: '④ Mô tả công việc 영역을 읽지 못함 — 배치 미검증' })
  const text = Object.fromEntries(keys.map((k) => [k, fold(canonMoney(areas[k] ?? ''))])) as Record<string, string>
  const phones = new Set<string>(); for (const m of source.matchAll(/(?:\+?84|0)[\d\s.\-]{8,14}\d/g)) { const n = phoneDigits(m[0]); if (n.length >= 9 && n.length <= 11) phones.add(n) }
  for (const raw of sourceLines(job.source_text)) {
    if (promoLike(raw)) continue
    const f = fold(canonMoney(raw)).trim()
    if (f.length < 10) continue
    let where = keys.filter((k) => text[k].includes(f))
    if (!where.length && hasPayAmount(raw)) {
      // 화면은 급여 이름표·금액 모양을 바꿔 보여 준다(Lương: 310k → Mức lương 310.000đ) — 글자 대신 금액으로 찾는다
      const want = amounts(raw)
      if (want.length) where = keys.filter((k) => { const have = new Set(amounts(areas[k] ?? '')); return want.every((n) => have.has(n)) })
    }
    if (!where.length) continue
    const isContact = [...raw.matchAll(/(?:\+?84|0)[\d\s.\-]{8,14}\d/g)].some((m) => phoneDigits(m[0]).length >= 9) || /\bzalo\b/.test(f)
    const isRequirement = /\b(?:gioi tinh|do tuoi|nam nu|nam\/nu|hoc van|bang cap|yeu cau)\b/.test(f) && !isContact
    const isPayOrTime = !isContact && !isRequirement && (hasPayAmount(raw) || timeRanges(raw).length > 0)
    const allowed: string[] | null = isContact ? ['④'] : isRequirement ? ['②', '④'] : isPayOrTime ? ['①', '④'] : null
    if (!allowed) continue
    const bad = where.filter((k) => !allowed.includes(k))
    // 허용 영역에도 나오면(승인된 표시 변환·반복) 오류로 보지 않는다 — 허용 영역에 전혀 없고 금지 영역에만 있을 때
    if (bad.length && !where.some((k) => allowed.includes(k))) out.push({ key: 'placement', sure: true, device: d, detail: `원문 줄 "${raw.slice(0, 50)}"이 ${bad.map((k) => k + AREA_TITLE[k as keyof typeof AREA_TITLE]).join(', ')}에 있음 — 허용 영역 ${allowed.join('·')}` })
  }
  if (phones.size && (areas['④'] ?? '').trim()) {
    const four = String(areas['④']).replace(/\D/g, '')
    if (![...phones].some((n) => four.includes(n.replace(/^0/, '')))) out.push({ key: 'placement', sure: false, device: d, detail: '원문 연락처 번호가 ④ 영역에 없음(빠짐 의심)' })
  }
  return out
}
// 금액 모양 통일(화면은 310k → 310.000đ 처럼 모양만 바꾼다): 천 단위 점·쉼표를 없애고 k는 000으로
const canonMoney = (s: string) => s.replace(/(\d)[ \u00a0]+(?=\d)/g, '$1').replace(/(\d{1,3}(?:[.,]\d{3})+)/g, (m) => m.replace(/[.,]/g, '')).replace(/(\d+)\s*k\b/gi, '$1000')

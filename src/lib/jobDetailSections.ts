/**
 * 상세요강(Mô tả công việc) 칸 나누기 — 2026-10-14 Lee 결정, 2026-10-19 코드 반영.
 * - 원문 줄은 글자를 바꾸지 않고 칸(01~07)에 옮기기만 한다.
 * - 지워도 되는 예외는 3가지뿐: ① 원문 소제목 줄 ② 제목 반복 ③ 화면 위에 이미 있는 정보(근무지 주소·전화번호).
 *   급여: 2026-10-25 Lee 결정으로 변경(이전 2026-10-19 "급여 줄은 위에 있어도 남긴다"를 대체) —
 *   상단 급여(총액)와 같은 금액만 다시 쓴 줄(예: "18 triệu", "Lương tối đa: 18 triệu", "Thu nhập: 8 - 18 triệu")과
 *   값 없는 급여 이름표 줄("Lương tối thiểu:")은 ③으로 뺀다. 급여 구성(기본급·수당·상여·잔업 등 내역) 줄은 남긴다.
 * - 예외 3가지 외에 한 줄이라도 빠지면 칸 나누기를 포기하고 원문 전체를 07에 그대로 보여 준다(기계 검사).
 * - 칸에 맞게 들어갔는지는 실제 공고 정답표(jobDetailSections.test.ts)로 검사한다.
 */
export const DETAIL_LABELS = {
  '01': 'Nội dung công việc',
  '02': 'Yêu cầu ứng viên',
  '03': 'Thời gian và hình thức làm việc',
  '04': 'Thu nhập và phụ cấp',
  '05': 'Phúc lợi và môi trường làm việc',
  '06': 'Quy trình tuyển dụng',
  '07': 'Thông tin bổ sung',
  '08': 'Hình ảnh tuyển dụng',
} as const
export type DetailKey = keyof typeof DETAIL_LABELS
export type DetailTextKey = Exclude<DetailKey, '08'>
export interface DetailSection { key: DetailTextKey; label: string; lines: string[] }
export type DropReason = 'heading' | 'title_repeat' | 'shown_above'
export interface DroppedLine { line: string; reason: DropReason }
const ORDER: DetailTextKey[] = ['01', '02', '03', '04', '05', '06', '07']

/** 화면 위쪽에 이미 보이는 정보(빼도 되는 줄 판단용). */
export interface ShownAbove {
  title?: string | null; phones?: Array<string | null | undefined>; addresses?: Array<string | null | undefined>; salary?: string | null
  /** 2026-10-25 Lee: 위쪽 칸(나이·성별·학력·경력·근무시간·근무일 등)에 이미 보이는 값. 같은 내용 줄은 아래에서 뺀다. */
  values?: Array<string | null | undefined>
  /** 근무시간+근무일처럼 위에서 나란히 보이는 값 묶음(합쳐서 비교). */
  valueGroups?: Array<Array<string | null | undefined>>
}

const wordsOf = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 2 || /\d/.test(t))
/** 줄 앞의 "- "·"Độ tuổi:" 같은 이름표를 뗀 내용. */
const contentOf = (line: string) => line.replace(/^\s*[-•*]\s*/, '').replace(/^[^:：]{1,30}[:：]\s*/, '')
/** 이 줄의 내용(이름표 제외)이 위쪽 칸 값 하나(또는 묶음)에 거의 다(85%) 들어 있는가. 내용 낱말 2개 미만은 판단하지 않음. */
export function coveredByAbove(line: string, above: ShownAbove): boolean {
  const need = wordsOf(contentOf(line))
  if (need.length < 2) return false
  const targets = [
    ...(above.values ?? []),
    ...(above.valueGroups ?? []).map((g) => g.filter(Boolean).join(' ')),
  ].filter((v): v is string => !!v && !!String(v).trim()).map((v) => wordsOf(String(v)))
  return targets.some((have) => need.filter((t) => have.some((u) => u === t || (t.length >= 3 && u.length >= 3 && (u.startsWith(t) || t.startsWith(u))))).length / need.length >= 0.85)
}

/** 글 속 금액(동 단위 정수). "18.000.000đ", "18 triệu", "5,5 triệu", "310k", "8 - 18 triệu"(앞 숫자도 triệu). */
export function salaryAmounts(text: string | null | undefined): number[] {
  const s = fold(String(text ?? '')).replace(/(\d)\s*[-–~]\s*(\d[\d.,]*)\s*(trieu|tr)\b/g, '$1 $3 - $2 $3')
  const out: number[] = []
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)*)\s*(trieu|tr\b|k\b|nghin|ngan|d\b|dong|vnd)?/g)) {
    const raw = m[1], unit = m[2] ?? ''
    if (unit === 'trieu' || unit === 'tr') { out.push(Math.round(Number(raw.replace(',', '.')) * 1_000_000)); continue }
    if (unit === 'k' || unit === 'nghin' || unit === 'ngan') { out.push(Math.round(Number(raw.replace(',', '.')) * 1_000)); continue }
    const n = Number(raw.replace(/[.,]/g, ''))
    if (raw.length >= 6 && n >= 100_000) out.push(n)     // 단위 없는 큰 숫자(18.000.000)
  }
  return out.filter((n) => Number.isFinite(n) && n > 0)
}
// 급여 "구성(내역)"을 나타내는 말 — 이런 말이 있으면 총액과 숫자가 같아도 남긴다.
const SALARY_BREAKDOWN = /\b(?:co ban|phu cap|tro cap|ho tro|thuong|tang ca|lam them|chuyen can|tham nien|nang suat|an ca|com|xang|nha o|ca ngay|ca dem|theo ngay|theo gio|\/h|\/gio|\/ngay|\/tuan|bao hiem|bhxh|thu viec|kpi|doanh so|hoa hong)\b/
const SALARY_LABEL_ONLY = /^(?:luong toi thieu|luong toi da|muc luong|luong|thu nhap|hinh thuc tra luong)\s*:?$/
/** 상단 급여와 같은 금액만 다시 쓴 줄 또는 값 없는 급여 이름표 줄인가(2026-10-25 Lee). */
export function isSalaryTotalRepeat(line: string, topSalary: string | null | undefined): boolean {
  const top = salaryAmounts(topSalary)
  if (!top.length) return false
  const s = bare(line)
  if (SALARY_LABEL_ONLY.test(s)) return true
  if (SALARY_BREAKDOWN.test(s)) return false
  const amounts = salaryAmounts(line)
  return amounts.length > 0 && amounts.every((a) => top.includes(a))
}

// Normalize ONLY for classification. Never emit normalized strings.
export function fold(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
}
export const bare = (line: string) => fold(line).replace(/^\s*[-•*]\s*/, '').replace(/[\s.:;,!]+$/g, '').replace(/\s+/g, ' ').trim()
const digits = (s: string) => s.replace(/\D/g, '')

// 원문 소제목 → 칸. "Lương và phúc lợi"처럼 급여·복리후생이 섞인 제목은 04로 두고, 줄 단위로 05를 골라낸다.
const HEADINGS: Array<[RegExp, DetailTextKey | 'address' | 'contact']> = [
  [/^(?:cong viec|mo ta cong viec|noi dung cong viec)$/, '01'],
  [/^(?:yeu cau|yeu cau tuyen dung|yeu cau ung vien|yeu cau co ban|yeu cau cong viec)$/, '02'],
  [/^(?:thoi gian lam viec|hinh thuc lam viec|lich lam viec)$/, '03'],
  [/^(?:luong va phuc loi|luong|luong thuong|muc luong|muc luong & phu cap|muc luong va phu cap|thu nhap)$/, '04'],
  [/^(?:quyen loi|quyen loi chinh|phuc loi|quyen loi & moi truong lam viec|quyen loi va moi truong lam viec|moi truong lam viec)$/, '05'],
  [/^(?:quy trinh tuyen dung|ho so ung tuyen|cach ung tuyen|cach thuc nop ho so|hinh thuc nop ho so)$/, '06'],
  [/^(?:thong tin khac|ghi chu|thong tin cong ty|thong tin co ban|hien so)$/, '07'],
  [/^(?:nganh nghe|loai hinh cong viec|hinh thuc tra luong|gioi tinh|do tuoi|hoc van toi thieu|ten cong ty|ca nhan dang tuyen)$/, '07'],
  [/^(?:dia diem lam viec|dia chi)$/, 'address'],
  [/^(?:lien he)$/, 'contact'],
]
export function headingOf(line: string) {
  const s = bare(line)
  return HEADINGS.find(([re]) => re.test(s))?.[1]
}
// 줄 하나만 보고 칸을 정하는 규칙(소제목 안이라도 내용이 분명하면 옮긴다).
export function lineBucket(line: string, current: DetailTextKey): DetailTextKey {
  const s = bare(line)
  if (/^(?:ca ngay|ca dem|luong|thuong|chuyen can|phu cap|tro cap|muc luong|tham nien|thu nhap|hinh thuc tra luong)\b/.test(s) || /^\d[\d.,]*\s*(?:trieu|dong|vnd|k)(?:\b|\/)/.test(s)) return '04'
  if (/^(?:co xe dua don|xe dua don|duoc mang dien thoai|co ky tuc xa|ky tuc xa|co bua an|bua an|ho tro an|bao hiem|phuc loi)\b/.test(s)) return '05'
  // 급여·복리후생이 섞인 칸(04) 안의 근무환경 설명은 05로(예: "Làm ngồi, thoải mái. Không bắt buộc tăng ca.").
  if (current === '04' && /(?:lam ngoi|thoai mai|khong bat buoc tang ca|moi truong)/.test(s)) return '05'
  if (/^(?:gio lam viec|thoi gian(?: lam viec)?|ngay lam|tang ca|lam them|loai hinh cong viec|toan thoi gian|ban thoi gian)\b/.test(s)) return '03'
  if (/^(?:do tuoi|gioi tinh|hoc van toi thieu|kinh nghiem|trung hoc|khong yeu cau|\d+\s*[-–]\s*\d+\s*tuoi|<\s*\d+\s*nam)\b/.test(s)) return '02'
  if (/^(?:nganh nghe|ban hang tai quay|tuyen nhan vien)\b/.test(s)) return '01'
  if (/^(?:phong van|nop ho so|quy trinh tuyen dung|ung tuyen|cach ung tuyen|ho so ung tuyen)\b/.test(s)) return '06'
  if (/^(?:chuong trinh cong tac vien|cong tac vien)\b/.test(s)) return '07'
  return current
}

export function sourceLines(description: string | null | undefined): string[] {
  if (!description) return []
  return description.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0)
}
function signature(lines: string[]): string {
  return JSON.stringify([...lines].sort())
}
/** 칸에 들어간 줄 + 예외로 뺀 줄 = 원문 줄(개수·글자까지 동일)인지. */
export function verifyDescriptionPreserved(original: string | null | undefined, sections: Pick<DetailSection, 'lines'>[], dropped: DroppedLine[] = []): boolean {
  return signature(sourceLines(original)) === signature([...sections.flatMap(section => section.lines), ...dropped.map(d => d.line)])
}
export interface DetailResult { sections: DetailSection[]; dropped: DroppedLine[]; preserved: boolean; usedFallback: boolean }

export function detailSections(description: string | null | undefined, above: ShownAbove = {}): DetailResult {
  const lines = sourceLines(description)
  if (!lines.length) return { sections: [], dropped: [], preserved: true, usedFallback: false }
  const buckets: Record<DetailTextKey, string[]> = { '01': [], '02': [], '03': [], '04': [], '05': [], '06': [], '07': [] }
  const dropped: DroppedLine[] = []
  const titleBare = above.title ? bare(above.title) : ''
  const phoneDigits = (above.phones ?? []).map((p) => digits(p ?? '')).filter((d) => d.length >= 8)
  const addressBare = (above.addresses ?? []).map((a) => bare(a ?? '')).filter(Boolean)
  let current: DetailTextKey = '07'
  let context: DetailTextKey | 'address' | 'contact' = '07'
  for (const line of lines) {
    const heading = headingOf(line)
    if (heading) { // ① 원문 소제목: 우리 칸 제목과 겹치므로 뺀다
      context = heading
      current = heading === 'address' || heading === 'contact' ? '07' : heading
      dropped.push({ line, reason: 'heading' })
      continue
    }
    const s = bare(line)
    if (titleBare && s === titleBare) { dropped.push({ line, reason: 'title_repeat' }); continue } // ② 제목 반복
    // ③ 위에 이미 있는 정보: 공고 전화번호가 들어 있는 연락 줄, 근무지 주소와 같은 줄
    const d = digits(line)
    if (context === 'contact' && phoneDigits.some((p) => d.includes(p))) { dropped.push({ line, reason: 'shown_above' }); continue }
    if (context === 'address' && addressBare.some((a) => a === s || a.startsWith(s) || s.startsWith(a))) { dropped.push({ line, reason: 'shown_above' }); continue }
    // 2026-10-25 Lee: 상단 급여 총액과 같은 금액 반복·값 없는 급여 이름표는 뺀다(급여 구성 줄은 남김)
    if (isSalaryTotalRepeat(line, above.salary)) { dropped.push({ line, reason: 'shown_above' }); continue }
    if (coveredByAbove(line, above)) { dropped.push({ line, reason: 'shown_above' }); continue }
    buckets[context === 'address' || context === 'contact' ? '07' : lineBucket(line, current)].push(line)
  }
  const sections = ORDER.filter(key => buckets[key].length).map(key => ({ key, label: DETAIL_LABELS[key], lines: buckets[key] }))
  if (!verifyDescriptionPreserved(description, sections, dropped)) {
    return { sections: [{ key: '07', label: DETAIL_LABELS['07'], lines }], dropped: [], preserved: false, usedFallback: true }
  }
  return { sections, dropped, preserved: true, usedFallback: false }
}

/** Exact original recruitment eligibility line for the top recruitment card.
 * Never infer a gender/age value or rewrite the source sentence. */
export function sourceRecruitmentEligibility(description: string | null | undefined): string | undefined {
  const sections = detailSections(description)
  if (!sections.preserved) return undefined
  const eligibility = sections.sections.find(s => s.key === '02')
  if (!eligibility) return undefined
  return eligibility.lines.find(line => /^\s*[-•*]?\s*(?:tuyển|tuyen|nam|nữ|nu)(?:\s|[,:.(]|$)/iu.test(line))
}

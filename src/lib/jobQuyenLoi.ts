// Lee 2026-10-29 상세페이지 새 구성(CLAUDE.md "공고 상세페이지 구성 확정"):
// 받는 것 줄 판정(지급 방식·주기 / Thưởng·Phụ cấp / 연장 수당 금액 / Bảo hiểm) — 4칸 틀에서 근무조건 급여 아래·복리후생에 원문 줄을 복사할 때 쓴다(상세요강에서도 지우지 않음).
// 식사·숙소·통근버스는 상단 아이콘에 있으므로 여기서 다루지 않는다.
import { salaryAmounts, type DetailSection } from './jobDetailSections'

/** 기준 공고(승인된 기존 틀 유지, Lee 2026-10-29 "기준 공고는 절대 건드리지 마"). */
export const BASELINE_FRAME_JOB_IDS: ReadonlySet<string> = new Set(['sb-4824'])

/** Lee 2026-10-30 "알바몬처럼": 상단 카드 + 근무조건·모집조건·근무지역·상세요강 4개. Quyền lợi 칸 없음,
 *  받는 것은 근무조건 급여 아래·복리후생에 원문 줄 그대로 복사(상세요강은 원문 전체, 지우지 않음). 먼저 이 공고만(Lee "이거만 먼저"). */
export const ALBAMON_LAYOUT_JOB_IDS: ReadonlySet<string> = new Set(['sb-4828'])

/** 틀은 2가지(Lee 2026-11-09 "적용"): 기준 공고(KDA)만 기존 틀, 나머지는 모두 #4828 알바몬 4칸 틀.
 *  예전 10-29 Quyền lợi 틀(3건)은 새 틀로 합치고 그 틀 전용 코드(받는 것 칸 옮기기)는 지웠다. */
export function usesAlbamonLayout(id: string): boolean {
  return ALBAMON_LAYOUT_JOB_IDS.has(id) || !BASELINE_FRAME_JOB_IDS.has(id)
}

/** 원문 줄을 지우지 않고 근무조건에 보일 줄만 고른다(급여 아래: 지급 방식·보너스·수당·연장 수당 / 복리후생: 보험). 01은 제외.
 *  급여 칸 정리(Lee 2026-11-10 "Mức lương 왜케 지저분해", 글 모형 #647 — 근무조건 한 칸 최대 3줄 규칙):
 *  ① 위 금액(topSalary)과 같은 금액이 든 줄은 빼고, 그 줄의 "chưa tính / đã gồm tăng ca"만 짧은 표시(overtimeNote)로
 *  ② "…:"로 끝나는 제목 줄, 대문자 홍보 줄("THƯỞNG GẮN BÓ ĐẾN 1.000.000Đ")은 뺀다 ③ 남은 줄은 3줄까지. 뺀 줄은 상세요강에 원문 그대로 있다. */
export const SALARY_CELL_MAX = 3
export function albamonConditionLines(sections: DetailSection[], topSalary?: string | null): { salary: string[]; insurance: string[]; overtimeNote?: string } {
  const salary: string[] = [], insurance: string[] = []
  const top = salaryAmounts(topSalary)
  let overtimeNote: string | undefined
  for (const sec of sections) {
    if (sec.key === '01') continue
    for (const raw of sec.lines) {
      const line = raw.replace(/^\s*[-•*]\s+/, '').trim()
      const key = quyenLoiKeyOf(line)
      if (key === 'insurance') { insurance.push(line); continue }
      if (!key) continue
      const t = lower(line)
      if (top.length && salaryAmounts(line).some((a) => top.includes(a))) {
        overtimeNote ??= /(?:chưa (?:tính|bao gồm|gồm)|chua tinh) (?:tăng ca|tang ca)/u.test(t) ? 'chưa tính tăng ca'
          : /(?:đã (?:gồm|bao gồm|tính)|bao gồm|da gom) (?:tăng ca|tang ca)/u.test(t) ? 'đã gồm tăng ca' : undefined
        continue
      }
      const letters = line.replace(/[^\p{L}]/gu, '')
      if (/[:：]\s*$/.test(line) || (letters.length >= 4 && letters === letters.toLocaleUpperCase('vi'))) continue
      salary.push(line)
    }
  }
  return { salary: [...new Set(salary)].slice(0, SALARY_CELL_MAX), insurance: [...new Set(insurance)], ...(overtimeNote ? { overtimeNote } : {}) }
}

/** "Độ tuổi: 18 - 50 tuổi" 같은 원문 줄에서 나이 값(모집조건 칸이 비어 있을 때만 씀). */
export function sourceAgeValue(sections: DetailSection[]): string | undefined {
  for (const sec of sections) for (const raw of sec.lines) {
    const m = raw.replace(/^\s*[-•*]\s+/, '').trim().match(/^(?:độ tuổi|tuổi)\s*[:：]\s*(.+)$/iu)
    if (m) return m[1].trim()
  }
  return undefined
}

export type QuyenLoiKey = 'pay' | 'bonus' | 'overtime' | 'insurance'

// 성조를 지우면 "thưởng"(보너스)과 "thường"(보통) 이 같아지므로 성조 있는 글자 그대로 비교한다(성조 없이 쓴 원문용 변형만 따로).
const lower = (s: string) => s.normalize('NFC').toLowerCase()
const PAY = /(trả lương|nhận lương|lĩnh lương|thanh toán lương|tra luong|nhan luong)/u
const INSURANCE = /(bhxh|bhyt|bảo hiểm|bao hiem)/u
const OVERTIME = /(tăng ca|tang ca)/u
const MONEY = /\d[\d.,]*\s*(k|đ|đồng|vnđ|vnd|%|lần|triệu|tr)(?![\p{L}])|x\s*\d/u
const BONUS = /(thưởng|phụ cấp|khích lệ|chuyên cần|trợ cấp|hỗ trợ (xăng|nhà|đi lại|tiền)|phu cap|khich le|chuyen can|tro cap)/u

/** 원문 한 줄이 어느 칸인지. 해당 없음 = null (상세요강에 그대로). */
// 원문 소제목 줄("Thu nhập và phụ cấp", "Quyền lợi:" 등)은 내용이 아니므로 옮기지 않는다.
const HEADING = /^(?:thu nhập(?: và phụ cấp)?|phúc lợi(?: và môi trường làm việc)?|quyền lợi|chế độ(?: đãi ngộ)?|lương thưởng|đãi ngộ)\s*[:：]?$/u
export function quyenLoiKeyOf(line: string): QuyenLoiKey | null {
  const t = lower(line).replace(/^\s*[-•*]\s+/, '').trim()
  if (HEADING.test(t)) return null
  if (INSURANCE.test(t)) return 'insurance'
  if (OVERTIME.test(t) && MONEY.test(t)) return 'overtime'
  if (BONUS.test(t)) return 'bonus'
  if (PAY.test(t)) return 'pay'
  return null
}

/** 2026-11-04: 근무조건 복리후생 칸용 보험 짧은 표시. 원문 줄에 적힌 보험만(BHXH·BHYT·BHTN), 없으면 'Bảo hiểm'. 지어내지 않음. */
export function insuranceTags(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const t = line.normalize('NFC').toLowerCase()
    const found = [
      [/bhxh|bảo hiểm xã hội/u, 'BHXH'], [/bhyt|bảo hiểm y tế/u, 'BHYT'], [/bhtn|bảo hiểm thất nghiệp/u, 'BHTN'],
    ].filter(([re]) => (re as RegExp).test(t)).map(([, tag]) => tag as string)
    for (const tag of found.length ? found : (/bảo hiểm|bh\b/u.test(t) ? ['Bảo hiểm'] : [])) if (!out.includes(tag)) out.push(tag)
  }
  return out
}

/**
 * 최신 4칸 틀 상세 구성(CLAUDE.md 「공고 상세페이지 구성 … 최종 확정」 2026-10-30, Lee 2026-11-10 "세부구성은 왜 안바꿔?").
 * 원문 줄(detailSections 결과)을 지우지 않고 확정 자리로 나눈다. 글자는 그대로.
 * - ② 모집조건: 자격 줄(02) → 'Kinh nghiệm'(경험 낱말 줄 1개, DB 값이 없을 때) + 'Yêu cầu khác'(나머지)
 * - ① 근무조건 Phụ cấp·Thưởng: 상여·수당 줄(albamonConditionLines, 최대 3줄) / 보험은 ① Phúc lợi 짧은 표시
 * - ④ 상세요강: Nội dung công việc(01 + 위에 없는 07 설명 줄) · Tăng ca(연장 줄) · Phụ cấp · Thưởng(① 3줄을 넘은 나머지만)
 *   · Môi trường làm việc(05 보험 외) · Quy trình tuyển dụng(06 연락처 외) · Liên hệ(전화·Zalo·이메일 줄)
 * - 위쪽에 이미 있는 줄(제목·회사 이름·근무지 주소와 같은 줄, 급여 금액 반복·제목·대문자 홍보 줄)은 ④에 다시 넣지 않는다.
 * - 근무시간·형태 줄(03 연장 외)은 ① 근무시간이 비어 있으면 그 칸(최대 3줄), 아니면 ④ Nội dung công việc 끝에 남긴다(지우지 않음).
 */
export interface Compose1030 {
  experience?: string
  otherRequirements: string[]
  allowance: string[]
  overtimeNote?: string
  hours: string[]
  detail: DetailSection[]
}
const CONTACT_LINE = /(?:điện thoại|đt|sđt|hotline|zalo|email|e-mail|liên hệ)\s*[:：]|(?:\+?84|0)[\d .-]{8,}\d|@[\w-]+\.[a-z]{2,}/iu
const OT_LINE = /tăng ca|tang ca|làm thêm giờ|ngoài giờ/iu
export function albamonCompose(sections: DetailSection[], ctx: { title?: string | null; company?: string | null; addresses?: (string | null | undefined)[]; salary?: string | null; hasHours?: boolean; preference?: string | null }): Compose1030 {
  const at = (k: string) => sections.find((s) => s.key === k)?.lines.map((l) => l.trim()) ?? []
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const above = [ctx.title, ctx.company, ...(ctx.addresses ?? [])].map((s) => fold(String(s ?? ''))).filter((s) => s.length >= 4)
  const shownAbove = (l: string) => { const f = fold(l); return !!f && above.some((a) => a === f || a.startsWith(f) || (f.length >= 12 && a.includes(f))) }
  const cond = albamonConditionLines(sections, ctx.salary)
  // 02 → ②
  const req = at('02')
  // ② Kinh nghiệm 칸에 DB 값이 이미 보이면 같은 줄은 다시 넣지 않는다
  const pref = fold(String(ctx.preference ?? ''))
  const expIdx = pref ? -1 : req.findIndex((l) => /kinh nghiệm|kinh nghiem/iu.test(l))
  const experience = expIdx >= 0 ? req[expIdx] : undefined
  const otherRequirements = req.filter((l, i) => i !== expIdx && !(pref && fold(l) === pref))
  // 03·04 → 연장 줄은 ④ Tăng ca, 나머지 03은 ① 근무시간(비었을 때)
  const ot: string[] = [], timeLines: string[] = []
  for (const l of at('03')) (OT_LINE.test(l) ? ot : timeLines).push(l)
  const top = salaryAmounts(ctx.salary)
  const payRest: string[] = []
  for (const l of at('04')) {
    if (OT_LINE.test(l) && !(top.length && salaryAmounts(l).some((a) => top.includes(a)))) { ot.push(l); continue }
    if (cond.salary.includes(l.replace(/^\s*[-•*]\s+/, ''))) continue
    if (top.length && salaryAmounts(l).some((a) => top.includes(a))) continue
    const letters = l.replace(/[^\p{L}]/gu, '')
    if (/[:：]\s*$/.test(l) || (letters.length >= 4 && letters === letters.toLocaleUpperCase('vi'))) continue
    payRest.push(l)
  }
  const hours = !ctx.hasHours ? timeLines.slice(0, SALARY_CELL_MAX) : []
  const timeRest = ctx.hasHours ? timeLines : timeLines.slice(SALARY_CELL_MAX)
  const env = at('05').filter((l) => quyenLoiKeyOf(l) !== 'insurance')
  const contact: string[] = [], process: string[] = []
  for (const l of at('06')) (CONTACT_LINE.test(l) ? contact : process).push(l)
  const extra: string[] = []
  for (const l of at('07')) { if (shownAbove(l)) continue; (CONTACT_LINE.test(l) ? contact : extra).push(l) }
  const detail: DetailSection[] = [
    // 회사 소개·모집 안내 줄("… cần tuyển …")은 업무 앞, 그 밖의 설명 줄은 업무 뒤
    { key: '01' as const, label: 'Nội dung công việc', lines: [...extra.filter((l) => /tuyển|tuyen/iu.test(l)), ...at('01'), ...extra.filter((l) => !/tuyển|tuyen/iu.test(l)), ...timeRest] },
    { key: '03' as const, label: 'Tăng ca', lines: ot },
    { key: '04' as const, label: 'Phụ cấp · Thưởng', lines: payRest.filter((l) => !cond.salary.includes(l)) },
    { key: '05' as const, label: 'Môi trường làm việc', lines: env },
    { key: '06' as const, label: 'Quy trình tuyển dụng', lines: process },
    { key: '07' as const, label: 'Liên hệ', lines: contact },
  ].filter((s) => s.lines.length) as DetailSection[]
  return { experience, otherRequirements, allowance: cond.salary, ...(cond.overtimeNote ? { overtimeNote: cond.overtimeNote } : {}), hours, detail }
}

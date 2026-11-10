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

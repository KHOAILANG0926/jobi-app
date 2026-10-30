// Lee 2026-10-29 상세페이지 새 구성(CLAUDE.md "공고 상세페이지 구성 확정"):
// ② Quyền lợi(받는 것) = 상단 카드에 없는 "받는 것"만 — 지급 방식·주기 / Thưởng·Phụ cấp / 연장 수당 금액 / Bảo hiểm.
// 원문 줄을 그대로 옮긴다(글자 변경·추정 없음). 옮긴 줄은 상세요강에서 다시 쓰지 않는다.
// 식사·숙소·통근버스는 상단 아이콘에 있으므로 여기서 다루지 않는다.
import type { DetailSection, DetailTextKey } from './jobDetailSections'

/** 기준 공고(승인된 기존 틀 유지, Lee 2026-10-29 "기준 공고는 절대 건드리지 마"). */
export const BASELINE_FRAME_JOB_IDS: ReadonlySet<string> = new Set(['sb-4824'])

/** Lee 2026-10-30 "알바몬처럼": 상단 카드 + 근무조건·모집조건·근무지역·상세요강 4개. Quyền lợi 칸 없음,
 *  받는 것은 근무조건 급여 아래·복리후생에 원문 줄 그대로 복사(상세요강은 원문 전체, 지우지 않음). 먼저 이 공고만(Lee "이거만 먼저"). */
export const ALBAMON_LAYOUT_JOB_IDS: ReadonlySet<string> = new Set(['sb-4828'])

/** Lee 2026-10-30 "신규부터": 지금 공개된 공고는 그대로 두고(아래 목록 = 10-29 Quyền lợi 틀 유지), 새로 들어오는 공고는 모두 #4828 알바몬 4칸 틀.
 *  기준 공고(KDA)는 기존 틀. 목록은 늘리지 않는다(새 공고를 여기에 넣지 말 것). */
export const LEGACY_QUYEN_LOI_JOB_IDS: ReadonlySet<string> = new Set(['sb-4878', 'sb-4879', 'sb-4982'])
export function usesAlbamonLayout(id: string): boolean {
  return ALBAMON_LAYOUT_JOB_IDS.has(id) || (!BASELINE_FRAME_JOB_IDS.has(id) && !LEGACY_QUYEN_LOI_JOB_IDS.has(id))
}

/** 원문 줄을 지우지 않고 근무조건에 보일 줄만 고른다(급여 아래: 지급 방식·보너스·수당·연장 수당 / 복리후생: 보험). 01은 제외. */
export function albamonConditionLines(sections: DetailSection[]): { salary: string[]; insurance: string[] } {
  const salary: string[] = [], insurance: string[] = []
  for (const sec of sections) {
    if (sec.key === '01') continue
    for (const raw of sec.lines) {
      const line = raw.replace(/^\s*[-•*]\s+/, '').trim()
      const key = quyenLoiKeyOf(line)
      if (key === 'insurance') insurance.push(line)
      else if (key) salary.push(line)
    }
  }
  return { salary: [...new Set(salary)], insurance: [...new Set(insurance)] }
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
export const QUYEN_LOI_LABELS: Record<QuyenLoiKey, string> = {
  pay: 'Trả lương', bonus: 'Thưởng · Phụ cấp', overtime: 'Tăng ca', insurance: 'Bảo hiểm',
}
export interface QuyenLoiRow { key: QuyenLoiKey; label: string; lines: string[] }

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

/** 상세요강 줄에서 Quyền lợi 칸을 만들고, 옮긴 줄을 뺀 상세요강을 돌려준다. 01(업무 내용)은 건드리지 않는다. */
export function splitQuyenLoi(sections: DetailSection[], extra: { periodLabel?: string; allowanceNote?: string } = {}) {
  const rows: Record<QuyenLoiKey, string[]> = { pay: [], bonus: [], overtime: [], insurance: [] }
  const rest: DetailSection[] = []
  for (const sec of sections) {
    if (sec.key === '01') { rest.push(sec); continue }
    const kept: string[] = []
    for (const line of sec.lines) {
      const key = quyenLoiKeyOf(line)
      if (key) rows[key].push(line.replace(/^\s*[-•*]\s+/, '').trim())
      else kept.push(line)
    }
    if (kept.length) rest.push({ ...sec, lines: kept })
  }
  if (!rows.pay.length && extra.periodLabel) rows.pay.push(extra.periodLabel)
  if (extra.allowanceNote && !rows.bonus.some((l) => lower(l).includes(lower(extra.allowanceNote!)))) rows.bonus.unshift(extra.allowanceNote)
  const list = (Object.keys(QUYEN_LOI_LABELS) as QuyenLoiKey[])
    .filter((k) => rows[k].length)
    .map((k) => ({ key: k, label: QUYEN_LOI_LABELS[k], lines: [...new Set(rows[k])] }))
  return { rows: list, sections: rest }
}

/** 상세요강 02(지원 자격)를 모집조건 "Yêu cầu khác"로 옮긴다. */
export function takeRequirementLines(sections: DetailSection[]): { lines: string[]; sections: DetailSection[] } {
  const key: DetailTextKey = '02'
  const sec = sections.find((s) => s.key === key)
  return { lines: (sec?.lines ?? []).map((l) => l.replace(/^\s*[-•*]\s+/, '').trim()).filter(Boolean), sections: sections.filter((s) => s.key !== key) }
}

// Lee 2026-10-29 상세페이지 새 구성(CLAUDE.md "공고 상세페이지 구성 확정"):
// ② Quyền lợi(받는 것) = 상단 카드에 없는 "받는 것"만 — 지급 방식·주기 / Thưởng·Phụ cấp / 연장 수당 금액 / Bảo hiểm.
// 원문 줄을 그대로 옮긴다(글자 변경·추정 없음). 옮긴 줄은 상세요강에서 다시 쓰지 않는다.
// 식사·숙소·통근버스는 상단 아이콘에 있으므로 여기서 다루지 않는다.
import type { DetailSection, DetailTextKey } from './jobDetailSections'

/** 기준 공고(승인된 기존 틀 유지, Lee 2026-10-29 "기준 공고는 절대 건드리지 마"). */
export const BASELINE_FRAME_JOB_IDS: ReadonlySet<string> = new Set(['sb-4824'])

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
export function quyenLoiKeyOf(line: string): QuyenLoiKey | null {
  const t = lower(line)
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

export type RecruitFieldKey = 'age' | 'gender' | 'education' | 'preference'
const FIELD_LINE: [RecruitFieldKey, RegExp][] = [
  ['age', /^(?:độ tuổi|tuổi)\s*[:：]\s*(.+)$/iu],
  ['gender', /^giới tính\s*[:：]\s*(.+)$/iu],
  ['education', /^(?:học vấn(?: tối thiểu)?|trình độ(?: học vấn)?)\s*[:：]\s*(.+)$/iu],
  ['preference', /^kinh nghiệm\s*[:：]\s*(.+)$/iu],
]
/** Lee 2026-10-30 "나이는 모집조건에": "Độ tuổi: …"처럼 칸 이름으로 시작하는 원문 줄은 그 칸으로 올린다.
 *  칸이 이미 채워져 있으면 같은 정보 반복이므로 뺀다. 섞인 문장(예: "Nam/nữ, tuổi từ 18 đến 45")은 그대로 둔다. */
export function promoteRequirementFields(lines: string[], filled: ReadonlySet<RecruitFieldKey>) {
  const fields: Partial<Record<RecruitFieldKey, string>> = {}
  const rest: string[] = []
  for (const line of lines) {
    const hit = FIELD_LINE.find(([, re]) => re.test(line.trim()))
    if (!hit) { rest.push(line); continue }
    const [key, re] = hit
    if (filled.has(key) || fields[key]) continue
    fields[key] = line.trim().match(re)![1].trim()
  }
  return { fields, lines: rest }
}

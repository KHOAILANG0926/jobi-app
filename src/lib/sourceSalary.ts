/**
 * 원문 급여 → 위쪽 급여 칸 — 2026-10-25 (검사표가 찾은 문제, #4879 ADTEK: 원문엔 9~17 triệu인데 급여 칸이 비어 있음).
 * 급여 칸이 비어 있을 때만, 원문 글자에서 그대로 가져온다(금액을 계산·추정하지 않음).
 *  1) 채용 사이트 정보 칸: "Lương tối thiểu: 9 triệu" + "Lương tối đa: 17 triệu" → "9 - 17 triệu" (+ "Hình thức trả lương: Theo tháng"이면 "/tháng")
 *  2) 아니면 "Lương: …"/"Mức lương: …"/"Thu nhập: …" 줄의 값(금액이 있을 때만)
 */
import { bare, salaryAmounts } from './jobDetailSections.ts'
import { cleanSourceText } from './jobDescriptionBuild.ts'

export interface SourceSalary { salary: string; period: 'month' | 'day' | 'hour' | null; evidence: string[] }

const valueOf = (line: string) => line.slice(line.search(/[:：]/) + 1).trim()

export function salaryFromSource(sourceText: string | null | undefined): SourceSalary | null {
  const lines = cleanSourceText(sourceText).text.split('\n').map((l) => l.trim()).filter(Boolean)
  const find = (re: RegExp) => lines.find((l) => re.test(bare(l)))
  const min = find(/^luong toi thieu:/), max = find(/^luong toi da:/), how = find(/^hinh thuc tra luong:/)
  const howB = how ? bare(valueOf(how)) : ''
  const period = /thang/.test(howB) ? 'month' : /ngay/.test(howB) ? 'day' : /gio/.test(howB) ? 'hour' : null
  const unit = period === 'month' ? '/tháng' : period === 'day' ? '/ngày' : period === 'hour' ? '/giờ' : ''
  if (min && max && salaryAmounts(min).length && salaryAmounts(max).length) {
    const a = valueOf(min), b = valueOf(max)
    // "9 triệu" + "17 triệu" → "9 - 17 triệu" (단위가 같을 때만 앞 단위 생략, 글자는 원문 그대로)
    const ua = a.replace(/^[\d.,\s]+/, ''), ub = b.replace(/^[\d.,\s]+/, '')
    const text = ua && ua === ub ? `${a.slice(0, a.length - ua.length).trim()} - ${b}` : `${a} - ${b}`
    return { salary: text + unit, period, evidence: [min, max, ...(how ? [how] : [])] }
  }
  const one = lines.find((l) => /^(?:luong|muc luong|thu nhap)\s*:/.test(bare(l)) && salaryAmounts(valueOf(l)).length > 0)
  if (one) return { salary: valueOf(one), period, evidence: [one] }
  return null
}

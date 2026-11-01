/**
 * 급여 칸을 읽는 곳은 여기 하나 — 2026-11-01 Lee "읽는 규칙을 하나로".
 * 전에는 수집기(Python extract_salary)·상세 채우기(salaryFromSource)·OCR(포스터 급여)이 각자 규칙으로 급여를 읽어
 * 서로 다른 값을 썼다(#5231: 다시 수집이 맞는 급여를 빈 값으로 덮음). 이제 수집기는 급여를 읽지 않고,
 * OCR 단계(사진 있는 공고)와 상세 채우기(사진 없는 공고)가 이 함수 하나로 급여 칸을 채운다.
 * 순서(앞이 이김): ① 원문 급여 이름표 줄(salaryFromSource) ② 원문 이름표 없는 금액 ③ 포스터 사진 금액 ④ 원문 "thỏa thuận"·"cạnh tranh" 글자.
 * 모두 원문·포스터 글자 그대로이며 계산·추정·바꿔 쓰기를 하지 않는다.
 */
import { salaryFromSource, type SourceSalary } from './sourceSalary.ts'
import { cleanSourceText } from './jobDescriptionBuild.ts'
import { bare } from './jobDetailSections.ts'

/** 포스터 사진 글자에서 급여 금액만 원문 그대로 고른다(주소·전화번호에서 추정하지 않음). */
export function posterSalaryEvidence(text: string | null | undefined): string[] {
  const ocr = String(text ?? '')
  const patterns = [
    /(?<!\d)\d{1,3}\s*(?:k|nghìn|nghin)\s*\/\s*(?:giờ|gio|h)(?![\p{L}\p{N}])/giu,
    /(?<!\d)\d{1,2}\s*[-–~]\s*\d{1,2}\s*(?:triệu|trieu|tr)(?:\s*\/\s*(?:tháng|thang))?(?![\p{L}\p{N}])/giu,
    /(?<!\d)\d{1,2}\s*(?:triệu|trieu|tr)\s*\/\s*(?:tháng|thang)(?![\p{L}\p{N}])/giu,
  ]
  const found = patterns.flatMap((pattern) => [...ocr.matchAll(pattern)].map((m) => ({ start: m.index ?? 0, value: m[0].trim() })))
  const selected: Array<{ start: number; value: string }> = []
  for (const p of found.sort((a, b) => a.start - b.start || b.value.length - a.value.length)) {
    if (!selected.some((q) => p.start < q.start + q.value.length && q.start < p.start + p.value.length)) selected.push(p)
  }
  return [...new Map(selected.map((p) => [bare(p.value), p.value])).values()]
}

// ② 이름표 없는 금액(옛 수집기 규칙을 옮김). "tr" 뒤에 글자가 이어지면(예: "trên") 금액이 아니다.
const TR = '(?:triệu|trieu|tr(?![\\p{L}]))'
const UNLABELED = [
  new RegExp(`\\d+[.,]?\\d*\\s*[-–~]\\s*\\d+[.,]?\\d*\\s*${TR}(?:\\s*\\/\\s*\\p{L}+|\\s*tháng|\\s*month)?`, 'iu'),
  new RegExp(`(?:từ|from)\\s*\\d+[.,]?\\d*\\s*${TR}`, 'iu'),
  new RegExp(`\\d+[.,]?\\d*\\s*${TR}(?:\\s*\\/\\s*\\p{L}+|\\s*tháng|\\s*month)?`, 'iu'),
  /\d+\s*[-–]\s*\d+\s*\$/u,
]
const SALARY_WORD = /\b(?:luong|thu nhap|muc luong|salary)\b/
const VAGUE = /(?:thu nhập cạnh tranh|lương cạnh tranh|thỏa thuận|thoả thuận)/iu

const periodOf = (v: string): SourceSalary['period'] => {
  const b = bare(v)
  return /\/\s*(?:gio|h)\b/.test(b) ? 'hour' : /\/\s*ngay\b/.test(b) ? 'day' : /(?:\/\s*thang\b|\bthang\b|\bmonth\b)/.test(b) ? 'month' : null
}

export function readSalary(sourceText: string | null | undefined, ocrText?: string | null): SourceSalary | null {
  const labeled = salaryFromSource(sourceText)
  if (labeled) return labeled
  const lines = cleanSourceText(sourceText).text.normalize('NFC').split('\n').map((l) => l.trim()).filter(Boolean)
  // 급여 단어가 있는 줄을 먼저 본다(상여·수당 줄의 금액을 급여로 잡지 않게).
  for (const pool of [lines.filter((l) => SALARY_WORD.test(bare(l))), lines]) {
    for (const re of UNLABELED) {
      for (const line of pool) {
        const m = line.match(re)
        if (m) return { salary: m[0].trim(), period: periodOf(m[0]), evidence: [line] }
      }
    }
  }
  const wages = posterSalaryEvidence(ocrText)
  if (wages.length) return { salary: 'Theo poster: ' + wages.join(' · '), period: null, evidence: wages }
  const vague = lines.find((l) => VAGUE.test(l))
  if (vague) return { salary: (vague.match(VAGUE) as RegExpMatchArray)[0], period: null, evidence: [vague] }
  return null
}

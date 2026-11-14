// R7 옮겨 적기 대조: DB에 적힌 값이 이미지 OCR 글자에도 있는지 본다. 순수 함수(네트워크·DB 없음).
// OCR도 틀릴 수 있어 어긋나면 "보류"만 하고 어느 항목인지 기록한다. 이름은 OCR이 성조를 자주 놓쳐 성조·대소문자를 무시하고 비교한다.
const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const digits = (x) => String(x ?? '').replace(/[^0-9]/g, '')

// 금액 표기를 원 단위 숫자 집합으로 바꾼다. "310k"·"310 nghìn"→310000, "8tr"·"8 triệu"→8000000, "310.000"·"8 000 000"→그대로.
// 단위 없이 1000 미만인 숫자(근무시간 "11h" 등)는 금액이 아니므로 버린다.
export function moneyValues(text) {
  const t = String(text ?? '').toLowerCase().replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1').replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1')
    // 범위 "13 - 15 triệu"·"8 – 15tr": 단위가 뒤 숫자에만 붙어도 앞 숫자에 같은 단위를 쓴다(#5505·#5506 오판).
    .replace(/(\d+(?:[.,]\d+)?)(\s*[-–~]\s*|\s+đến\s+)(\d+(?:[.,]\d+)?)\s*(k|nghìn|nghin|ngàn|ngan|triệu|trieu|tr|m)(?![a-zà-ỹ])/g, '$1 $4$2$3 $4')
  const out = new Set()
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)*)\s*(?:(k|nghìn|nghin|ngàn|ngan|triệu|trieu|tr|m)(?![a-zà-ỹ]))?/g)) {
    let raw = m[1]; const unit = m[2]
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(raw)
    const num = thousands ? Number(raw.replace(/[.,]/g, '')) : Number(raw.replace(',', '.').replace(/\.(?=.*\.)/g, ''))
    if (!Number.isFinite(num)) continue
    const mult = unit ? (/^(k|nghìn|nghin|ngàn|ngan)$/.test(unit) ? 1000 : 1e6) : 1
    const v = Math.round(num * mult)
    if (v >= 1000) out.add(v)
  }
  return out
}

/** Strict source-backed wage expressions: no phone/address numbers or inferred work period.
 * Multiple figures may apply to different roles; preserve each without associating it to a role. */
// 포스터 급여 금액 고르기는 급여 읽는 곳 하나(src/lib/salaryReader.ts)로 옮김 — 2026-11-01 Lee "읽는 규칙을 하나로".
import { posterSalaryEvidence } from '../../src/lib/salaryReader.ts'
export { posterSalaryEvidence }

// job: { employer_phone, contact_zalo, salary, contact_name, company, age_min, age_max }
export function compareWithOcr(job, ocrText) {
  const ocr = String(ocrText ?? '')
  // 읽을 글자가 거의 없으면 포스터 글자와 비교할 것이 없다. 수집·관리자 공고는 사실이 포스터에서 올 수 있어 '읽기불가'로 비공개를 유지하지만,
  // 고용주·legacy 공고는 사실을 직접 입력한 값(원문 칸에 같이 저장)이라 글자 없는 일반 사진(근무지·대표 사진, #800)은 막지 않는다 — 아래 대조를 원문만으로 해서
  // 모두 원문으로 뒷받침되면 'no_text'(통과), 하나라도 사진에만 기댄 값이면 'unreadable' 그대로. 글자가 있는 포스터는 이 분기를 타지 않고 기존 대조 그대로.
  const noText = fold(ocr).length < 8
  const ocrDigits = digits(ocr)
  const ocrFold = ` ${fold(ocr)} `
  const ocrTokens = new Set((ocr.match(/\d+/g) ?? []).map(String))
  // A body-sourced fact does not have to be repeated on the poster. OCR checks
  // poster-sourced facts; otherwise it falsely blocks valid Facebook text posts.
  const sourceFold = ` ${fold(job.source_text)} `
  const sourceDigits = digits(job.source_text)
  const bodyProvesText = (value) => !!fold(value) && sourceFold.includes(` ${fold(value)} `)
  const mismatches = []
  for (const f of ['employer_phone', 'contact_zalo']) {
    const d = digits(job[f])
    if (d && !sourceDigits.includes(d) && !ocrDigits.includes(d)) mismatches.push({ field: f, value: d })
  }
  // 급여: 310k = 310000 = 310.000 = 310 nghìn 처럼 표기가 달라도 같은 숫자로 비교한다.
  const ocrMoney = moneyValues(ocr)
  const sourceMoney = moneyValues(job.source_text)
  const posterWages = posterSalaryEvidence(ocr)
  const competitiveWithoutAmount = /(?:thu\s*nhập|thu\s*nhap|lương|luong)\s+cạnh\s*tranh/iu.test(String(job.source_text ?? '')) && moneyValues(job.salary).size === 0
  if (competitiveWithoutAmount) mismatches.push({ field: 'salary', value: job.salary || '', poster_value: posterWages.join(' · '), reason: 'numeric_wage_required' })
  for (const n of moneyValues(job.salary)) if (!sourceMoney.has(n) && !ocrMoney.has(n) && !ocrDigits.includes(String(n))) mismatches.push({ field: 'salary', value: n })
  for (const f of ['contact_name', 'company']) {
    const v = fold(job[f])
    if (v && !bodyProvesText(job[f]) && !ocrFold.includes(` ${v} `)) mismatches.push({ field: f, value: job[f] })
  }
  for (const f of ['age_min', 'age_max']) {
    const sourceAges = new Set((String(job.source_text ?? '').match(/\d+/g) ?? []).map(String))
    if (job[f] != null && !sourceAges.has(String(job[f])) && !ocrTokens.has(String(job[f]))) mismatches.push({ field: f, value: job[f] })
  }
  if (noText) return { status: ['employer', 'legacy'].includes(job.origin) && !mismatches.length ? 'no_text' : 'unreadable', mismatches: [] }
  return { status: mismatches.length ? 'mismatch' : 'ok', mismatches }
}

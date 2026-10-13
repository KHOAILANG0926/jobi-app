// R7 옮겨 적기 대조: DB에 적힌 값이 이미지 OCR 글자에도 있는지 본다. 순수 함수(네트워크·DB 없음).
// OCR도 틀릴 수 있어 어긋나면 "보류"만 하고 어느 항목인지 기록한다. 이름은 OCR이 성조를 자주 놓쳐 성조·대소문자를 무시하고 비교한다.
const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const digits = (x) => String(x ?? '').replace(/[^0-9]/g, '')

// job: { employer_phone, contact_zalo, salary, contact_name, company, age_min, age_max }
export function compareWithOcr(job, ocrText) {
  const ocr = String(ocrText ?? '')
  if (fold(ocr).length < 8) return { status: 'unreadable', mismatches: [] }   // 읽을 글자가 거의 없으면 비교하지 않는다
  const ocrDigits = digits(ocr)
  const ocrFold = ` ${fold(ocr)} `
  const ocrTokens = new Set((ocr.match(/\d+/g) ?? []).map(String))
  const mismatches = []
  for (const f of ['employer_phone', 'contact_zalo']) {
    const d = digits(job[f])
    if (d && !ocrDigits.includes(d)) mismatches.push({ field: f, value: d })
  }
  const salaryNums = [...new Set((String(job.salary ?? '').match(/\d[\d.,]*/g) ?? []).map(digits).filter((n) => n.length >= 2))]
  for (const n of salaryNums) if (!ocrDigits.includes(n)) mismatches.push({ field: 'salary', value: n })
  for (const f of ['contact_name', 'company']) {
    const v = fold(job[f])
    if (v && !ocrFold.includes(` ${v} `)) mismatches.push({ field: f, value: job[f] })
  }
  for (const f of ['age_min', 'age_max']) {
    if (job[f] != null && !ocrTokens.has(String(job[f]))) mismatches.push({ field: f, value: job[f] })
  }
  return { status: mismatches.length ? 'mismatch' : 'ok', mismatches }
}

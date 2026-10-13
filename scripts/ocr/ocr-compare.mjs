// R7 옮겨 적기 대조: DB에 적힌 값이 이미지 OCR 글자에도 있는지 본다. 순수 함수(네트워크·DB 없음).
// OCR도 틀릴 수 있어 어긋나면 "보류"만 하고 어느 항목인지 기록한다. 이름은 OCR이 성조를 자주 놓쳐 성조·대소문자를 무시하고 비교한다.
const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const digits = (x) => String(x ?? '').replace(/[^0-9]/g, '')

// 금액 표기를 원 단위 숫자 집합으로 바꾼다. "310k"·"310 nghìn"→310000, "8tr"·"8 triệu"→8000000, "310.000"·"8 000 000"→그대로.
// 단위 없이 1000 미만인 숫자(근무시간 "11h" 등)는 금액이 아니므로 버린다.
export function moneyValues(text) {
  const t = String(text ?? '').toLowerCase().replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1').replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1')
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
  // 급여: 310k = 310000 = 310.000 = 310 nghìn 처럼 표기가 달라도 같은 숫자로 비교한다.
  const ocrMoney = moneyValues(ocr)
  for (const n of moneyValues(job.salary)) if (!ocrMoney.has(n) && !ocrDigits.includes(String(n))) mismatches.push({ field: 'salary', value: n })
  for (const f of ['contact_name', 'company']) {
    const v = fold(job[f])
    if (v && !ocrFold.includes(` ${v} `)) mismatches.push({ field: f, value: job[f] })
  }
  for (const f of ['age_min', 'age_max']) {
    if (job[f] != null && !ocrTokens.has(String(job[f]))) mismatches.push({ field: f, value: job[f] })
  }
  return { status: mismatches.length ? 'mismatch' : 'ok', mismatches }
}

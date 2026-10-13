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

// OCR가 'ok'가 된 뒤 OCR 단계에서 active=true로 돌려도 되는 공고인가(기존 공개 조건 부분).
// 정책 판정(R4)·U2(age_min<15)는 DB 트리거가 최종 강제하므로 여기서는 보지 않는다(걸리면 트리거가 비공개 유지/거부).
// crawler 공고는 publish_gate_reason='ok'가 필요하고 admin 공고는 이 값을 보지 않는다. 관리자가 끈 공고·만료로 꺼진 공고·R7 이전 공고를 되살리지 않도록 R7 도입 이후 생성분만 대상으로 한다.
export const OCR_REPUBLISH_FROM = '2026-10-13'
export function canRepublish(job, today = new Date().toISOString().slice(0, 10)) {
  // origin='admin'은 publish_gate_reason을 채우는 코드가 없다(크롤러 전용 값). 관리자가 직접 등록·승인했으므로 이 값은 보지 않는다(2026-10-14 결정 A).
  const gateOk = job.origin === 'admin' || job.publish_gate_reason === 'ok'
  return gateOk && job.admin_hidden === false
    && String(job.created_at instanceof Date ? job.created_at.toISOString() : job.created_at).slice(0, 10) >= OCR_REPUBLISH_FROM
    && (!job.application_deadline || String(job.application_deadline instanceof Date ? job.application_deadline.toISOString() : job.application_deadline).slice(0, 10) >= today)
}

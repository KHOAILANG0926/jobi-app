// 급여 칸 확정·저장은 여기 한 곳(R2 #753, 급여 중복 쓰기 제거).
// 전에는 ① ocr-check(ingest_job 입구) ② detail-fill(직접 UPDATE) ③ job-repair(AI 제안 직접 UPDATE)가 각자 급여를 썼다.
// 이제 ① 읽기: readSalary 한 함수(Lee 2026-11-01 "읽는 규칙을 하나로") ② 덮어써도 되는지: 아래 정책 ③ 쓰기: ingest_job 한 입구(직접 SQL 금지).
// 정책(mode):
//  - 'empty'   : 수집 공고(crawler)의 빈 급여 칸만 채운다(OCR 단계 — 값이 이미 있으면 바꾸지 않아 R7 대조가 어긋남을 잡을 수 있다).
//  - 'refresh' : 수집 공고는 읽는 규칙이 바뀌면 다시 읽어 맞춘다(상세 채우기 단계). 관리자·Lee 등록 공고는 사람이 쓴 값이라 빈 칸만 채운다.
// 계산·추정 없음(원문·포스터 글자 그대로). 같은 값이면 쓰지 않는다.
import { readSalary, MULTI_ROLE_SALARY } from '../../src/lib/salaryReader.ts'
import { parseSalaryInfo } from '../../src/lib/recommendStorage.ts'

export function planSalaryFill(job, posterText, mode) {
  if (!String(job.source_text ?? '').trim()) return null
  const empty = !String(job.salary ?? '').trim()
  const crawler = job.origin === 'crawler'
  const allowed = mode === 'empty' ? crawler && empty : mode === 'refresh' ? crawler || empty : false
  if (!allowed) return null
  const sal = readSalary(job.source_text, posterText)
  if (!sal || sal.salary === job.salary) return null
  return sal
}

// 급여 숫자 칸(salary_min·max·currency·negotiable — 일자리 알림이 비교, 20260927090000 job_alerts)은 급여 글자에서만 만든다(Lee 2026-11-25 C 작업).
// 금액 글자 하나가 통째로 아래 모양일 때만 숫자로 옮긴다. 여러 직무 글자·포스터 요약·시간이 섞인 글자("350K/11h")는 숫자 칸을 비운다(추정·합산 금지).
const AMOUNT = String.raw`\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?`
const MONEY_ONLY = new RegExp(String.raw`^(?:(từ|trên|tối thiểu|đến|lên đến|tối đa)\s+)?(${AMOUNT})\s*(?:(?:triệu|tr|k|đ|đồng|vnđ|vnd)\s*)?(?:[-–~]\s*(?:đến\s+)?(${AMOUNT})\s*(?:triệu|tr|k|đ|đồng|vnđ|vnd)?\s*)?(?:\/\s*(?:tháng|ngày|giờ|h|ca|tuần))?$`, 'iu')
/** 급여 글자 → 숫자 칸. 숫자로 옮길 수 없으면 null(칸을 비움). 협의 표현은 negotiable만. */
export function planSalaryAmounts(text) {
  const t = String(text ?? '').trim()
  if (!t || t === MULTI_ROLE_SALARY || /^Theo poster/i.test(t)) return null
  const info = parseSalaryInfo(t)
  if (info.isNegotiable) return { salary_min: null, salary_max: null, salary_currency: null, salary_negotiable: true }
  const m = t.normalize('NFC').match(MONEY_ONLY)
  if (!m || !info.range || info.range.min < 1000) return null
  const bound = (m[1] ?? '').toLowerCase()
  const single = !m[3]
  const lowerOnly = single && /^(từ|trên|tối thiểu)$/.test(bound)
  const upperOnly = single && /^(đến|lên đến|tối đa)$/.test(bound)
  return { salary_min: upperOnly ? null : info.range.min, salary_max: lowerOnly ? null : info.range.max,
    salary_currency: info.currency, salary_negotiable: false }
}
const AMOUNT_FIELDS = ['salary_min', 'salary_max', 'salary_currency', 'salary_negotiable']

/** 급여를 읽어 정책이 허용하면 ingest_job 한 입구로 쓴다. 쓴 값({salary, period}) 또는 null.
 *  숫자 칸은 최종 급여 글자에서 다시 만들고, 지금 값과 다를 때만 같은 입구 호출에 넣는다(사람이 쓴 관리자 공고는 숫자 칸이 비었을 때만). */
export async function fillSalary(client, job, posterText, mode) {
  const sal = planSalaryFill(job, posterText, mode)
  const crawler = job.origin === 'crawler'
  const amountsEmpty = AMOUNT_FIELDS.every((k) => job[k] == null)
  const amounts = (crawler || amountsEmpty) && (mode === 'refresh' || mode === 'empty') && String(job.source_text ?? '').trim()
    ? (planSalaryAmounts(sal?.salary ?? job.salary) ?? { salary_min: null, salary_max: null, salary_currency: null, salary_negotiable: null }) : null
  const amountChanged = amounts && AMOUNT_FIELDS.some((k) => (amounts[k] ?? null) !== (job[k] ?? null))
  if (!sal && !amountChanged) return null
  const payload = {
    channel: crawler ? 'crawler_other' : 'admin', job_id: job.id, refresh: true,
    update_fields: [...(sal ? ['salary', 'salary_period'] : []), ...(amountChanged ? AMOUNT_FIELDS : [])],
    source_text: job.source_text, images: job.images ?? null,
    ...(sal ? { salary: sal.salary, salary_period: sal.period } : {}), ...(amountChanged ? amounts : {}),
  }
  const written = await client.query('select public.ingest_job($1::jsonb) as job_id', [JSON.stringify(payload)])
  if (Number(written.rows[0]?.job_id) !== Number(job.id)) throw new Error('ingest_job salary refresh returned wrong id')
  return sal ?? null
}

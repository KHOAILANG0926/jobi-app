// 급여 칸 확정·저장은 여기 한 곳(R2 #753, 급여 중복 쓰기 제거).
// 전에는 ① ocr-check(ingest_job 입구) ② detail-fill(직접 UPDATE) ③ job-repair(AI 제안 직접 UPDATE)가 각자 급여를 썼다.
// 이제 ① 읽기: readSalary 한 함수(Lee 2026-11-01 "읽는 규칙을 하나로") ② 덮어써도 되는지: 아래 정책 ③ 쓰기: ingest_job 한 입구(직접 SQL 금지).
// 정책(mode):
//  - 'empty'   : 수집 공고(crawler)의 빈 급여 칸만 채운다(OCR 단계 — 값이 이미 있으면 바꾸지 않아 R7 대조가 어긋남을 잡을 수 있다).
//  - 'refresh' : 수집 공고는 읽는 규칙이 바뀌면 다시 읽어 맞춘다(상세 채우기 단계). 관리자·Lee 등록 공고는 사람이 쓴 값이라 빈 칸만 채운다.
// 계산·추정 없음(원문·포스터 글자 그대로). 같은 값이면 쓰지 않는다.
import { readSalary } from '../../src/lib/salaryReader.ts'

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

/** 급여를 읽어 정책이 허용하면 ingest_job 한 입구로 쓴다. 쓴 값({salary, period}) 또는 null. */
export async function fillSalary(client, job, posterText, mode) {
  const sal = planSalaryFill(job, posterText, mode)
  if (!sal) return null
  const payload = {
    channel: job.origin === 'crawler' ? 'crawler_other' : 'admin', job_id: job.id, refresh: true, update_fields: ['salary', 'salary_period'],
    source_text: job.source_text, images: job.images ?? null, salary: sal.salary, salary_period: sal.period,
  }
  const written = await client.query('select public.ingest_job($1::jsonb) as job_id', [JSON.stringify(payload)])
  if (Number(written.rows[0]?.job_id) !== Number(job.id)) throw new Error('ingest_job salary refresh returned wrong id')
  return sal
}

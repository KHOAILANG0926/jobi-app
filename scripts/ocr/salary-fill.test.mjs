// 급여 확정·저장 한 곳(salary-fill) 시험(R2 #753): 정책(빈칸만/다시 읽기/사람이 쓴 값 보호)과 쓰기 방식(ingest_job 한 입구, 직접 UPDATE 없음).
import assert from 'node:assert/strict'
import { planSalaryFill, fillSalary, planSalaryAmounts } from './salary-fill.mjs'

const SRC = 'Tuyển công nhân\nMức lương: 8 triệu/tháng\nLiên hệ: 0912345678'
const job = (extra) => ({ id: 77, origin: 'crawler', salary: '', source_text: SRC, images: [], ...extra })
const fake = (returnId = 77) => { const q = []; return { q, query: async (sql, params) => { q.push({ sql, params }); return { rows: [{ job_id: returnId }] } } } }

// 정책
assert.ok(planSalaryFill(job({}), null, 'empty'), '수집 공고 빈 급여 칸은 채움(OCR 단계)')
assert.equal(planSalaryFill(job({ salary: '5 triệu/tháng' }), null, 'empty'), null, '값이 있으면 OCR 단계는 바꾸지 않음(R7 대조가 어긋남을 잡도록)')
assert.ok(planSalaryFill(job({ salary: '5 triệu/tháng' }), null, 'refresh'), '수집 공고는 읽는 규칙이 바뀌면 다시 읽어 맞춤(상세 채우기 단계)')
assert.equal(planSalaryFill(job({ salary: '8 triệu/tháng' }), null, 'refresh'), null, '같은 값이면 쓰지 않음')
assert.equal(planSalaryFill(job({ origin: 'admin', salary: '5 triệu/tháng' }), null, 'refresh'), null, '관리자·Lee 등록 공고의 사람이 쓴 값은 덮어쓰지 않음')
assert.ok(planSalaryFill(job({ origin: 'admin' }), null, 'refresh'), '관리자 공고도 빈 칸은 채움')
assert.equal(planSalaryFill(job({ origin: 'admin' }), null, 'empty'), null, 'OCR 단계는 수집 공고만')
assert.equal(planSalaryFill(job({ source_text: '' }), null, 'refresh'), null, '원문이 없으면 추정하지 않음')
assert.equal(planSalaryFill(job({}), null, 'bogus'), null, '알 수 없는 정책은 쓰지 않음')

// 쓰기 방식: 항상 ingest_job 한 입구, 급여 두 칸만, 직접 UPDATE 없음
{
  const c = fake()
  const r = await fillSalary(c, job({ salary: '5 triệu/tháng' }), null, 'refresh')
  assert.ok(r && /8 triệu/.test(r.salary))
  assert.equal(c.q.length, 1)
  assert.ok(/^select public\.ingest_job\(/.test(c.q[0].sql) && !/update/i.test(c.q[0].sql), 'ingest_job 한 입구')
  const p = JSON.parse(c.q[0].params[0])
  assert.deepEqual(p.update_fields, ['salary', 'salary_period', 'salary_min', 'salary_max', 'salary_currency', 'salary_negotiable']); assert.equal(p.channel, 'crawler_other'); assert.equal(p.refresh, true)
  assert.equal(p.salary_min, 8000000); assert.equal(p.salary_max, 8000000); assert.equal(p.salary_currency, 'VND')
  const a = fake(); await fillSalary(a, job({ origin: 'admin' }), null, 'refresh')
  assert.equal(JSON.parse(a.q[0].params[0]).channel, 'admin', '관리자 공고는 admin 경로')
}
{
  const done = { salary: '8 triệu/tháng', salary_min: 8000000, salary_max: 8000000, salary_currency: 'VND', salary_negotiable: false }
  const c = fake(); assert.equal(await fillSalary(c, job(done), null, 'refresh'), null); assert.equal(c.q.length, 0, '쓸 것이 없으면 DB를 부르지 않음')
}
// 급여 숫자 칸(Lee 2026-11-25 C 작업): 급여 글자 그대로만 숫자로 — 여러 직무·포스터 요약·시간 섞인 글자는 비움(추정·합산 금지)
{
  assert.deepEqual(planSalaryAmounts('8 - 10 triệu/ tháng'), { salary_min: 8000000, salary_max: 10000000, salary_currency: 'VND', salary_negotiable: false })
  assert.deepEqual(planSalaryAmounts('Từ 10.000.000đ/tháng'), { salary_min: 10000000, salary_max: null, salary_currency: 'VND', salary_negotiable: false }, '하한만 — 상한을 만들지 않음')
  assert.deepEqual(planSalaryAmounts('Đến 15 triệu'), { salary_min: null, salary_max: 15000000, salary_currency: 'VND', salary_negotiable: false }, '상한만')
  assert.equal(planSalaryAmounts('Theo vị trí — xem chi tiết'), null, '여러 직무 급여는 합치지 않음')
  assert.equal(planSalaryAmounts('350K/11h'), null, '시간이 섞인 글자는 숫자로 옮기지 않음')
  assert.equal(planSalaryAmounts('Theo poster: 8 triệu'), null, '포스터 요약은 옮기지 않음')
  assert.equal(planSalaryAmounts('Thỏa thuận').salary_negotiable, true)
  // 같은 급여 글자라도 숫자 칸이 비어 있으면 숫자 칸만 쓴다
  const c = fake(); assert.equal(await fillSalary(c, job({ salary: '8 triệu/tháng' }), null, 'refresh'), null)
  const p = JSON.parse(c.q[0].params[0]); assert.deepEqual(p.update_fields, ['salary_min', 'salary_max', 'salary_currency', 'salary_negotiable']); assert.ok(!('salary' in p))
  // 관리자 공고는 숫자 칸이 이미 있으면 건드리지 않음(사람이 쓴 값)
  const a = fake(); await fillSalary(a, job({ origin: 'admin', salary: '8 triệu/tháng', salary_min: 7000000 }), null, 'refresh'); assert.equal(a.q.length, 0)
}
await assert.rejects(() => fillSalary(fake(999), job({}), null, 'empty'), /wrong id/, '다른 공고 번호가 돌아오면 실패')
console.log('salary-fill.test.mjs: 정책 8건·쓰기 방식(ingest_job 한 입구)·급여 숫자 칸 통과')

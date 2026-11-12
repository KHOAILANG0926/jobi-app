// 급여 칸(local_jobs.salary) 자동 쓰기는 한 곳뿐이어야 한다(R2 #753): scripts/ocr/salary-fill.mjs가 읽기(readSalary)·덮어써도 되는지·쓰기(ingest_job 한 입구)를 맡는다.
// 다른 자동 작업 스크립트가 `update local_jobs set … salary = …`로 직접 쓰면(확정된 값 덮어쓰기·읽기 규칙 우회) 실패한다.
// 사람이 입력하는 경로(관리자 화면·고용주 작성)는 앱/API라서 이 검사 대상이 아니다. 시험·e2e·SQL 파일은 제외.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const root = new URL('../../', import.meta.url).pathname
const ALLOWED = new Set(['scripts/ocr/salary-fill.mjs'])   // ingest_job 호출만 하며 직접 UPDATE는 없음(아래에서 따로 확인)
const files = []
const walk = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) { if (!/node_modules|\.git$|jobs$|fixtures|test-fixtures/.test(f)) walk(f) } else if (/\.(mjs|js|ts)$/.test(n) && !/\.test\.|e2e|\.fixture/.test(n)) files.push(f) } }
for (const d of ['scripts', 'api', 'crawler']) walk(join(root, d))
const DIRECT = /update\s+(?:public\.)?local_jobs\b[^;`]*?\bsalary\s*=/is
const offenders = files.map((f) => f.slice(root.length)).filter((rel) => DIRECT.test(readFileSync(join(root, rel), 'utf8')))
assert.deepEqual(offenders, [], `급여를 local_jobs에 직접 UPDATE하는 자동 작업 파일이 있음 — scripts/ocr/salary-fill.mjs(fillSalary)로 통합해야 함: ${offenders.join(', ')}`)
const writer = readFileSync(join(root, 'scripts/ocr/salary-fill.mjs'), 'utf8')
assert.ok(/ingest_job/.test(writer) && !DIRECT.test(writer), 'salary-fill은 ingest_job 한 입구로만 쓴다')
assert.ok(ALLOWED.has('scripts/ocr/salary-fill.mjs'))
console.log('salary-single-writer.test.mjs: 급여 자동 쓰기는 salary-fill 한 곳(직접 UPDATE 없음)')

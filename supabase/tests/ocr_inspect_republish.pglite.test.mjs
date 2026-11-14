// OCR 불일치 → 비공개 → 검사표 통과 → 재공개 흐름을 실제 코드로 시험 (PGlite, 운영 DB 접속 없음) — #728 R4 4단계.
// 모사 없이: 실제 migration 트리거, 실제 OCR 쓰기 SQL(ocrCheckUpdateSql), 실제 검사표 실행기(scripts/ops/job-inspect.mjs)를 PGlite 소켓 서버에 붙여 돌린다.
// 규칙: 공고를 올리는 쓰기는 검사표 한 곳 — OCR 단계는 내리기만 한다(OCR이 다시 ok여도 혼자 올리지 않는다).
// 실행: npm i --no-save --legacy-peer-deps @electric-sql/pglite@0.5.8 @electric-sql/pglite-socket@0.2.19
//       node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs supabase/tests/ocr_inspect_republish.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { ocrCheckUpdateSql } from '../../scripts/ocr/ocr-check-write.mjs'
import { INSPECT_RECORD_SQL, CLEAR_OCR_HOLD_SQL } from '../../scripts/ops/job-inspect-write.mjs'
import { ingestSourceText } from '../../src/lib/jobPolicyWrite.ts'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const PORT = Number(process.env.PGLITE_TEST_PORT || 54329)
const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin;
create table public.job_posting_rules(rule_key text, check_ref text[]);
create table public.job_brands(id int, name text, slug text, category text, domain text, logo_url text, initial text, color text, active boolean, featured boolean);
create table public.job_brand_aliases(brand_id int, alias text, is_primary boolean, active boolean);
create table public.job_work_locations(job_id bigint, raw_address text, point_kind text, location_verified boolean, lat double precision, lng double precision);
create table public.map_r1_location_jobs(job_id bigint, result jsonb);
create table public.map_r1_unlocated(job_id bigint, reason text);
create table public.local_jobs (id bigint primary key, origin text, title text default '', company text, contact_name text, salary text, salary_min numeric, salary_max numeric, salary_period text,
  location text, description text, source_text text, ocr_text text, images jsonb default '[]', image_url text, company_domain text, logo_lookup jsonb, employer_phone text, contact_zalo text,
  category text, occupation_code text, hours text, work_days text, age_requirement text, gender_requirement text, education text, preference text, num_hires text, language_requirement text,
  age_min int, age_max int, publish_gate_reason text, recruitment_regions jsonb, required_documents text, shuttle_bus boolean, dormitory boolean, meal_provided boolean, employment_type text, work_period text, application_deadline date,
  active boolean default true, admin_hidden boolean not null default false, ocr_check jsonb, urgent boolean, created_at timestamptz default now(), updated_at timestamptz default now());`)
for (const f of ['20261101110000_job_inspect_content_hash.sql', '20261101170000_inspect_keep_public.sql', '20261113000000_inspect_gate_employer_legacy.sql']) await db.exec(read(`../migrations/${f}`))
// 실제 DB 공개 게이트(연락처·근무지 없으면 크롤러 공고 공개 거부) — 함수·트리거 부분만(그 뒤는 규정 표 갱신이라 이 시험 표에 없음). 이 트리거는 거부할 때 inspect_hold를 남기지 않는다.
await db.exec(read('../migrations/20261101190000_db_publish_gate.sql').split('-- 기존 공고에 계산값을')[0])

const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' })
await server.start()
// 검사표 실행기를 그대로 실행한다(GH_TOKEN·REPO를 비워 이슈 알림은 건너뜀). 부모 프로세스가 소켓 서버라 반드시 비동기로 실행한다.
const runInspect = () => new Promise((resolve) => {
  const p = spawn('node', ['--experimental-strip-types', '--import', './scripts/ts-extensionless-register.mjs', 'scripts/ops/job-inspect.mjs'],
    { env: { ...process.env, SUPABASE_DB_URL: `postgres://postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`, GH_TOKEN: '', REPO: '' } })
  let err = ''
  p.stderr.on('data', (d) => { err += d })
  const t = setTimeout(() => p.kill(), 120000)
  p.on('close', (code) => { clearTimeout(t); resolve({ code, err }) })
})
const state = async () => (await db.query(`select active, ocr_check->>'inspect_hold' as hold, ocr_check->'inspect'->>'publishable' as publishable,
  (select string_agg(i->>'key', ',') from jsonb_array_elements(coalesce(ocr_check->'inspect'->'items', '[]'::jsonb)) i where (i->>'ok') = 'false') as failing from public.local_jobs where id = 1`)).rows[0]
const inspect = async () => { const r = await runInspect(); assert.equal(r.code, 0, 'job-inspect.mjs 실패: ' + r.err.slice(0, 500)); return state() }

try {
  const f = { title: 'Nhân viên bán hàng', company: 'Cửa hàng ABC', salary: '8 triệu/tháng', location: 'Số 1 Lý Thái Tổ, Bắc Ninh', hours: '8h-17h', description: 'Bán hàng, tư vấn khách.\nLàm việc theo ca.', employer_phone: '0912345678' }
  await db.query(`insert into public.local_jobs(id, origin, title, company, salary, location, hours, description, source_text, employer_phone, category, occupation_code, images, ocr_text, active)
    values (1, 'crawler', $1, $2, $3, $4, $5, $6, $7, $8, 'ban_hang', '5', '["a.png"]'::jsonb, 'poster text', true)`,
  [f.title, f.company, f.salary, f.location, f.hours, f.description, ingestSourceText({ ...f, category: 'ban_hang' }), f.employer_phone])
  await db.query(`insert into public.job_work_locations values (1, 'Số 1 Lý Thái Tổ, Bắc Ninh', 'exact', true, 21.1, 106.0)`)

  let s = await state()
  assert.equal(s.active, false, '새 크롤러 공고는 검사 전에 DB 트리거가 비공개로 둔다')
  assert.equal(s.hold, 'true')

  s = await inspect()
  assert.equal(s.active, false, '화면 대조·OCR 전에는 검사표도 공개하지 않는다')
  assert.equal(s.publishable, 'false')

  const hash = (await db.query(`select public.job_inspect_content_hash(j) as h from public.local_jobs j where id = 1`)).rows[0].h
  await db.query(`update public.local_jobs set ocr_check = ocr_check || jsonb_build_object('status', 'ok', 'reader', 'ai-v1',
    'screen_audit', jsonb_build_object('content_hash', $1::text, 'ok', true, 'findings', '[]'::jsonb, 'checked_at', now())) where id = 1`, [hash])
  s = await inspect()
  assert.equal(s.active, true, '검사 통과 → 검사표가 공개')

  // OCR 불일치: OCR 쓰기가 내린다(실제 ocrCheckUpdateSql)
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])
  assert.equal((await state()).active, false, 'OCR 불일치는 즉시 비공개')
  s = await inspect()
  assert.equal(s.active, false, 'OCR 불일치인 동안 검사표도 비공개 유지')
  assert.match(s.failing, /ocr/)

  // OCR이 다시 ok: OCR은 올리지 않는다. 올리는 것은 검사표 통과뿐.
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])
  assert.equal((await state()).active, false, 'OCR ok만으로는 공개되지 않는다(OCR 단계는 올리지 않음)')
  s = await inspect()
  assert.equal(s.active, true, '검사표가 통과시키면 다시 공개')
  assert.equal(s.publishable, 'true')

  // Codex P1(4ff6fae): OCR이 공개 공고를 내린 뒤 검사표가 돌기 전에 OCR이 다시 ok가 되면(검사표 호출 없음) 재공개가 끊기던 사례
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])
  assert.equal((await state()).active, false, 'OCR 불일치로 내림')
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])   // 검사표 없이 바로 정상 복구
  assert.equal((await state()).active, false, 'OCR은 직접 올리지 않는다')
  s = await inspect()
  assert.equal(s.active, true, '검사표 없이 복구돼도 OCR이 내린 공고는 다음 검사표가 다시 공개')
  assert.equal((await db.query(`select ocr_check ? 'ocr_hold' as has from public.local_jobs where id = 1`)).rows[0].has, false, '다시 공개되면 OCR 내림 표지는 지워짐')

  // OCR 불일치가 이미 비공개였던 공고(소유자 철회 등)를 건드려도 그 공고를 되살리는 표지를 만들지 않는다
  await db.query(`update public.local_jobs set active = false where id = 1`)
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])
  s = await inspect()
  assert.equal(s.active, false, '다른 이유로 이미 내려간 공고는 OCR 복구만으로 검사표가 되살리지 않음(기존 공고 보호)')
  await db.query(`update public.local_jobs set active = true where id = 1`)   // 다음 시험을 위해 공개 상태로(트리거: 검사 기록이 지금 내용과 같아 허용)

  // OCR이 내린 뒤 관리자가 숨기면 OCR 복구·검사 통과여도 되살리지 않고, OCR 내림 표지도 지운다
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])
  await db.query(`update public.local_jobs set admin_hidden = true where id = 1`)
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])
  s = await inspect()
  assert.equal(s.active, false, 'OCR이 내린 뒤 관리자가 숨긴 공고는 되살리지 않음')
  assert.equal((await db.query(`select ocr_check ? 'ocr_hold' as has from public.local_jobs where id = 1`)).rows[0].has, false, '관리자 숨김이면 OCR 내림 표지를 지움(숨김을 풀어도 저절로 되살아나지 않음)')
  await db.query(`update public.local_jobs set admin_hidden = false where id = 1`)
  s = await inspect()
  assert.equal(s.active, false, '관리자가 숨김을 풀어도 표지가 없으면 검사표가 혼자 올리지 않음')
  await db.query(`update public.local_jobs set active = true where id = 1`)

  // 동시 실행: 검사표가 공고를 읽은 뒤(공개·OCR ok) OCR 불일치 내림이 끼어들면, 검사표의 낡은 판정이 그 내림을 덮어쓰지 못한다
  const hashNow = async () => (await db.query(`select public.job_inspect_content_hash(j) as h from public.local_jobs j where id = 1`)).rows[0].h
  const stale = { hash: await hashNow(), record: JSON.stringify({ content_hash: await hashNow(), publishable: true, items: [{ key: 'public', ok: true }] }) }
  assert.equal((await state()).active, true)
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])   // 검사표가 읽은 뒤 OCR이 내림
  const lost = await db.query(INSPECT_RECORD_SQL, [1, stale.record, true, stale.hash, false, false, true, 'ok'])          // 검사표의 낡은 읽기(active=true, ocr=ok)로 쓰기
  assert.equal(lost.rowCount, 0, '낡은 읽기로는 OCR이 내린 공고를 다시 올리지 못함')
  assert.equal((await state()).active, false)
  assert.equal((await db.query(`select ocr_check ? 'ocr_hold' as has from public.local_jobs where id = 1`)).rows[0].has, true, '낡은 쓰기가 OCR 내림 표지를 지우지 않음')
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])
  assert.equal((await inspect()).active, true, '다음 실행의 새 읽기로는 정상적으로 다시 공개')

  // 기존 공개 공고: 내용이 바뀌어도(트리거) 공개 유지, 검사표가 통과시키면 그대로 공개
  await db.query(`update public.local_jobs set description = description || E'\nThêm dòng mô tả.' where id = 1`)
  assert.equal((await state()).active, true, '공개 중인 공고는 내용이 바뀌어도 내려가지 않음(DB 트리거)')
  assert.equal((await inspect()).active, true, '검사표도 공개 중인 공고를 유지')

  // 소유자 철회(고용주 공고): 검사 대기 표지가 없으면 검사표가 되살리지 않는다
  const ef = { ...f, title: 'Nhân viên bán hàng B' }
  await db.query(`insert into public.local_jobs(id, origin, title, company, salary, location, hours, description, source_text, employer_phone, category, occupation_code, images, ocr_text, active)
    values (2, 'employer', $1, $2, $3, $4, $5, $6, $7, $8, 'ban_hang', '5', '["b.png"]'::jsonb, 'poster text', true)`,
  [ef.title, ef.company, ef.salary, ef.location, ef.hours, ef.description, ingestSourceText({ ...ef, category: 'ban_hang' }), ef.employer_phone])
  await db.query(`insert into public.job_work_locations values (2, 'Số 1 Lý Thái Tổ, Bắc Ninh', 'exact', true, 21.1, 106.0)`)
  assert.equal((await db.query(`select active from public.local_jobs where id = 2`)).rows[0].active, false, '고용주 신규 공고도 검사 전에는 비공개(DB 트리거)')
  const h2 = (await db.query(`select public.job_inspect_content_hash(j) as h from public.local_jobs j where id = 2`)).rows[0].h
  await db.query(`update public.local_jobs set ocr_check = ocr_check || jsonb_build_object('status', 'no_text', 'reader', 'ai-v1',
    'screen_audit', jsonb_build_object('content_hash', $1::text, 'ok', true, 'findings', '[]'::jsonb, 'checked_at', now())) where id = 2`, [h2])
  await runInspect()
  assert.equal((await db.query(`select active from public.local_jobs where id = 2`)).rows[0].active, true, '고용주 신규 공고도 검사 통과 후 공개')
  await db.query(`update public.local_jobs set active = false where id = 2`)   // 소유자 철회
  await runInspect()
  assert.equal((await db.query(`select active from public.local_jobs where id = 2`)).rows[0].active, false, '소유자가 철회한 공고는 검사 통과여도 검사표가 되살리지 않음')

  // Codex P1(4aaa5bc): 검사표가 active=true를 요청해도 다른 DB 공개 규정(여기서는 연락처 없으면 크롤러 공고 공개 거부)이 막으면 실제 결과는 비공개다.
  // 그때 OCR 내림 표지를 지우면 원인을 고친 뒤 되살릴 근거가 사라진다 — 실제로 공개된 것이 확인될 때만 지운다.
  const hasMark = async () => (await db.query(`select ocr_check ? 'ocr_hold' as has from public.local_jobs where id = 1`)).rows[0].has
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])
  const auditOk = async () => { const h = await hashNow(); await db.query(`update public.local_jobs set ocr_check = ocr_check || jsonb_build_object('screen_audit', jsonb_build_object('content_hash', $1::text, 'ok', true, 'findings', '[]'::jsonb, 'checked_at', now())) where id = 1`, [h]) }   // 화면 대조가 지금 내용을 확인했다는 기록
  await db.query(`update public.local_jobs set employer_phone = null where id = 1`)   // 원인: 연락처가 비었다(원문에는 번호가 있어 검사표는 통과시킴)
  await auditOk()
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])
  s = await inspect()
  assert.equal(s.publishable, 'true', '검사표 판정은 통과(공개 요청): ' + s.failing)
  assert.equal(s.active, false, 'DB 공개 게이트가 거부하면 실제 결과는 비공개')
  assert.equal(await hasMark(), true, '공개가 실제로 거부됐으면 OCR 내림 표지를 지우지 않는다')
  await db.query(`update public.local_jobs set employer_phone = $1 where id = 1`, [f.employer_phone])   // 원인 수정
  await auditOk()
  s = await inspect()
  assert.equal(s.active, true, '원인을 고친 뒤 재검사로 정상 공개')
  assert.equal(await hasMark(), false, '실제로 공개된 뒤에야 OCR 내림 표지를 지움')

  // 표지 삭제 문장 자체의 조건: 공개 확인 뒤 삭제 직전에 OCR이 다시 내렸다면(active=false) 표지를 지우지 않는다. (job-inspect.mjs는 기록·삭제·보정을 한 트랜잭션으로 묶어 이 틈 자체를 막고, 이 조건은 두 번째 안전장치)
  await db.query(ocrCheckUpdateSql(true), [1, 'poster text', JSON.stringify({ status: 'mismatch', reader: 'ai-v1' })])
  const cleared = await db.query(CLEAR_OCR_HOLD_SQL, [1])
  assert.equal(cleared.rowCount, 0, '비공개 상태에서는 OCR 내림 표지를 지우지 않음')
  assert.equal(await hasMark(), true)
  await db.query(ocrCheckUpdateSql(false), [1, 'poster text', JSON.stringify({ status: 'ok', reader: 'ai-v1' })])
  assert.equal((await inspect()).active, true, '표지가 남아 있어 다음 검사표가 정상 재공개')
  assert.equal(await hasMark(), false)

  // 관리자가 숨긴 공고는 검사표가 되살리지 않는다
  await db.query(`update public.local_jobs set active = false, admin_hidden = true where id = 1`)
  s = await inspect()
  assert.equal(s.active, false, '관리자 숨김 공고는 검사 통과여도 되살리지 않음')
  console.log('ocr_inspect_republish: OCR 불일치 → 비공개 → 검사표 통과 → 재공개 (실제 job-inspect.mjs 실행) 통과')
} finally {
  await server.stop()
}
process.exit(0)

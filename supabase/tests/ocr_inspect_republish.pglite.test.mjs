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
  age_min int, age_max int, required_documents text, shuttle_bus boolean, dormitory boolean, meal_provided boolean, employment_type text, work_period text, application_deadline date,
  active boolean default true, admin_hidden boolean not null default false, ocr_check jsonb, urgent boolean, created_at timestamptz default now(), updated_at timestamptz default now());`)
for (const f of ['20261101110000_job_inspect_content_hash.sql', '20261101170000_inspect_keep_public.sql', '20261113000000_inspect_gate_employer_legacy.sql']) await db.exec(read(`../migrations/${f}`))

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

  // 관리자가 숨긴 공고는 검사표가 되살리지 않는다
  await db.query(`update public.local_jobs set active = false, admin_hidden = true where id = 1`)
  s = await inspect()
  assert.equal(s.active, false, '관리자 숨김 공고는 검사 통과여도 되살리지 않음')
  console.log('ocr_inspect_republish: OCR 불일치 → 비공개 → 검사표 통과 → 재공개 (실제 job-inspect.mjs 실행) 통과')
} finally {
  await server.stop()
}
process.exit(0)

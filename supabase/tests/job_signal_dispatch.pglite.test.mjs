// 20261025160000_job_signal_dispatch.sql 사전 점검(PGlite + pg_cron·pg_net·vault 흉내, 운영 DB 접속 없음).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_signal_dispatch.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; create schema vault; create schema net; create schema cron;
create table vault.decrypted_secrets(name text, decrypted_secret text);
insert into vault.decrypted_secrets values ('github_dispatch_token', 'test-token');
create table net.calls(id bigserial primary key, url text, body jsonb, headers jsonb);
create table net._http_response(id bigint, status_code int);
create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int) returns bigint language sql as $$
  insert into net.calls(url, body, headers) values (url, body, headers) returning id $$;
create table cron.job(jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns int language sql as $$ insert into cron.job(jobname, schedule, command) values (n, s, c) returning jobid $$;
create function cron.unschedule(id int) returns boolean language sql as $$ delete from cron.job where jobid = id returning true $$;
create table public.local_jobs (id bigint primary key, title text, company text, source_text text, images jsonb, location text, active boolean,
  admin_hidden boolean default false, occupation_code text, category text, description text, salary text, ocr_check jsonb, created_at timestamptz default now());
create table public.job_work_locations(id bigserial primary key, job_id bigint);
create table public.map_r1_location_jobs(job_id bigint primary key, result jsonb);
create table public.map_r1_unlocated(job_id bigint primary key);
create table public.crawl_source_state(source text primary key, paused boolean default false);`)
const mig = readFileSync(new URL('../migrations/20261025160000_job_signal_dispatch.sql', import.meta.url), 'utf8')
await db.exec(mig); await db.exec(mig) // 두 번 적용해도 같음
const q = async (sql) => (await db.query(sql)).rows
const since = async (wf) => (await q(`select requested_at from public.job_signal_queue where workflow = '${wf}'`))[0].requested_at

assert.equal((await q(`select count(*)::int n from cron.job where jobname in ('job-signal-send','job-signal-daily')`))[0].n, 2, '시계 2개(두 번 적용해도 2개)')
await db.exec(`update public.job_signal_queue set requested_at = null`)
await db.exec(`insert into public.local_jobs(id, title, active) values (1, 't', false)`)
assert.ok(await since('job-ocr-check.yml'), '새 공고 → 요청')
// 결과 칸(상세요강·급여·ocr_check)만 바뀌면 신호 없음 — 검사 작업이 자기 자신을 계속 부르지 않게
await db.exec(`update public.job_signal_queue set requested_at = null`)
await db.exec(`update public.local_jobs set description = 'x', salary = '1', ocr_check = '{}' where id = 1`)
assert.equal(await since('job-ocr-check.yml'), null, '결과 칸 변경은 신호 없음')
assert.ok((await q(`select updated_at from public.local_jobs where id = 1`))[0].updated_at, '마지막으로 고친 시각 기록')
await db.exec(`update public.local_jobs set source_text = '원문' where id = 1`)
assert.ok(await since('job-ocr-check.yml'), '원문 변경 → 요청')
await db.exec(`update public.job_signal_queue set requested_at = null; insert into public.map_r1_unlocated values (1)`)
assert.ok(await since('job-ocr-check.yml'), '위치 결과 변경 → 요청')
await db.exec(`insert into public.crawl_source_state values ('chotot', false); update public.crawl_source_state set paused = true`)
assert.ok(await since('crawl-guard.yml'), '수집 멈춤 → 감시 작업 요청')
// 30초 조용하면 한 번만 보냄
assert.equal((await q(`select public.job_signal_send(false) n`))[0].n, 0, '30초 전에는 안 보냄')
await db.exec(`update public.job_signal_queue set requested_at = now() - interval '1 minute' where requested_at is not null`)
assert.equal((await q(`select public.job_signal_send(false) n`))[0].n, 2, '두 작업 신호')
assert.equal((await q(`select public.job_signal_send(false) n`))[0].n, 0, '같은 요청은 한 번만')
const call = (await q(`select url, headers from net.calls order by id limit 1`))[0]
assert.ok(/\/actions\/workflows\/(job-ocr-check|crawl-guard)\.yml\/dispatches$/.test(call.url), 'GitHub 신호 주소')
assert.ok(call.headers.Authorization === 'Bearer test-token' && call.headers['User-Agent'], 'GitHub 신호 형식')
// 안전망은 요청이 없어도 보냄
assert.equal((await q(`select public.job_signal_send(true) n`))[0].n, 2, '하루 1번 안전망')
assert.equal((await q(`select has_table_privilege('anon', 'public.job_signal_queue', 'select') p`))[0].p, false)
console.log('job_signal_dispatch: 입력 변경만 신호·30초 모아 한 번·멈춤 감시·안전망·형식·공개 차단 검사 통과')

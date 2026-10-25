// 20261025120000_crawl_source_guard.sql 사전 점검(PGlite, 로컬 흉내 DB — 운영 DB 접속 없음).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/crawl_source_guard.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table public.local_jobs (id bigint primary key, title text, origin text, source text, active boolean default false, ocr_check jsonb);
create table public.map_r1_unlocated (job_id bigint primary key references public.local_jobs(id) on delete cascade, reason text default 'our_miss');`)
const mig = readFileSync(new URL('../migrations/20261025120000_crawl_source_guard.sql', import.meta.url), 'utf8')
await db.exec(mig); await db.exec(mig) // 두 번 적용해도 같음
const st = async (s) => (await db.query(`select paused, reason, sample_job_ids, fix_attempts from public.crawl_source_state where source = '${s}'`)).rows[0]

// 실패 2건으로는 안 멈춤, 원인이 다르면 안 멈춤
for (const id of [1, 2]) await db.exec(`insert into public.local_jobs(id, origin, source) values (${id}, 'crawler', 'chotot'); insert into public.map_r1_unlocated(job_id) values (${id});`)
assert.equal((await st('chotot')).paused, false, '2건은 멈추지 않음')
await db.exec(`insert into public.local_jobs(id, origin, source) values (3, 'crawler', 'chotot'); update public.local_jobs set ocr_check = '{"status":"mismatch"}' where id = 3;`)
assert.equal((await st('chotot')).paused, false, '원인이 다르면 멈추지 않음')
// 같은 원인 3건 연속 → 멈춤
for (const id of [4, 5]) await db.exec(`insert into public.local_jobs(id, origin, source) values (${id}, 'crawler', 'chotot'); insert into public.map_r1_unlocated(job_id) values (${id});`)
await db.exec(`insert into public.local_jobs(id, origin, source) values (6, 'crawler', 'chotot'); insert into public.map_r1_unlocated(job_id) values (6);`)
const s1 = await st('chotot')
assert.equal(s1.paused, true, '같은 원인 3건 → 멈춤')
assert.equal(s1.reason, 'location_not_found')
assert.deepEqual([...s1.sample_job_ids].map(Number).sort(), [4, 5, 6])
// 멈춘 소스는 새 수집 공고 저장 거부, 다른 소스·직접 등록은 계속
await assert.rejects(db.exec(`insert into public.local_jobs(id, origin, source) values (7, 'crawler', 'chotot')`), /crawl_source_paused/)
await db.exec(`insert into public.local_jobs(id, origin, source) values (8, 'crawler', 'muaban')`)
await db.exec(`insert into public.local_jobs(id, origin, source) values (9, 'admin', 'manual:poster:x')`)
// 직접 등록 공고는 세지 않음
assert.equal((await db.query(`select count(*)::int n from public.crawl_job_outcomes where job_id = 9`)).rows[0].n, 0)
// 원인 공고 일부만 해결 → 아직 멈춤, 전부 해결 → 자동 재개
await db.exec(`delete from public.map_r1_unlocated where job_id in (4, 5)`)
assert.equal((await st('chotot')).paused, true, '일부 해결은 계속 멈춤')
await db.exec(`delete from public.map_r1_unlocated where job_id = 6`)
assert.equal((await st('chotot')).paused, false, '전부 해결 → 자동 재개')
await db.exec(`insert into public.local_jobs(id, origin, source) values (7, 'crawler', 'chotot')`)
// 공개되면 성공으로 기록
await db.exec(`update public.local_jobs set active = true where id = 7`)
assert.equal((await db.query(`select bool_and(ok) ok from public.crawl_job_outcomes where job_id = 7`)).rows[0].ok, true)
// 공개 접근 막힘
assert.equal((await db.query(`select has_table_privilege('anon', 'public.crawl_source_state', 'select') p`)).rows[0].p, false)
console.log('crawl_source_guard: 3건 연속 멈춤·소스별 차단·자동 재개·공개 접근 차단 검사 통과')

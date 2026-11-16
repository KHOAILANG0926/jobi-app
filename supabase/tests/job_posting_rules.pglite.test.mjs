// job_posting_rules 마이그레이션 + supabase/tests/job_posting_rules_test.sql 를 PGlite에서 사전 점검한다.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_posting_rules.pglite.test.mjs
// 한계: 시험용 DB(PGlite)다 — 운영 DB에는 시험 공고를 넣지 않는다(#858, 2026-11-16). CI: occupation-publication-check.yml(publication-gate).
// 범위(정확히): 규칙 R1~R7·U2를 구현한 함수(enforce_job_posting_policy·enforce_job_posting_rules·job_occupation_publish_reason 등)는 이후 migration이 다시 정의한 마지막 판까지 올린다(10-28 lee_verified_sources = R3 원문 근거 보호 포함, 2026-11-16 grep 확인).
// 이 시험이 다루지 않는 것: 위치 판정(map_r1·location_single_source·area_pin — 이름이 비슷한 별도 '위치 R1')과 10-29 입구 트리거(직접 insert 거부) — 각각 자기 운영 점검(ingest_gateway_production_check 등)·시험이 맡는다.
// 운영 쪽은 읽기 전용 운영 점검(rule_check_refs_production_check.sql 등: 규칙 표·트리거 존재)이 migrations-apply마다 확인한다.
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { readFileSync } from 'node:fs'
const f = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const db = new PGlite({ extensions: { unaccent } })
await db.exec(`
create extension unaccent;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
create table public.local_jobs (id bigint generated always as identity primary key, title text not null, company text not null,
  category text default 'other', salary text, employer_phone text, description text, active boolean default true,
  origin text not null default 'legacy', admin_hidden boolean not null default false, source_url text, images jsonb,
  contact_zalo text, policy_decision text, source text); -- source: 운영에 있는 출처 칸(10-28 규칙 함수가 읽음, lee_source.pglite.test.mjs와 같음)
grant all on public.local_jobs to service_role; grant usage on schema public to service_role;
`)
await db.exec(f('../migrations/20261012153000_job_posting_policy_db_enforcement.sql'))
await db.exec(f('../migrations/20261013100000_job_posting_rules.sql'))
await db.exec(f('../migrations/20261013100000_job_posting_rules.sql')) // 멱등성
// 2026-11-16(#858): 시험 SQL이 10-15 뒤 직업분류 공개 조건(원문 근거 있는 공식 코드)을 전제로 쓰므로(R7 공개 대조·U2), 운영과 같은 순서로 직업분류 migration을 올린다
// (supabase/tests/occupation_publication.pglite.test.mjs와 같은 5개). 운영 DB 시험(job-rules-apply)은 10-29 입구 트리거(직접 insert 거부) 뒤 모든 시험 insert가 막혀 전부 '실패'로 보였으므로 이 시험이 그 역할을 맡는다.
for (const m of ['20261015100000_occupation_master.sql', '20261015100100_occupation_master_seed.sql', '20261015120000_local_jobs_occupation_r8.sql',
  '20261017070517_occupation_publication_gate.sql', '20261018090000_occupation_code_any_level.sql']) await db.exec(f(`../migrations/${m}`))
// 규칙 트리거 함수(public.enforce_job_posting_rules)를 다시 정의한 이후 migration — 지금 운영 규칙(R3 원문 근거 보호, Lee 확인 출처)으로 같은 시험을 돈다.
// (함수를 다시 정의한 migration은 이것 하나: grep 'function public.enforce_job_posting_rules' supabase/migrations, 2026-11-16 확인)
await db.exec(f('../migrations/20261028034009_lee_verified_sources.sql'))
await db.exec(f('./job_posting_rules_test.sql'))
const rows = (await db.query('select rule_key,last_test_result from job_posting_rules order by id')).rows
console.table(rows)
const left = (await db.query("select count(*)::int n from local_jobs where title like '[RULE-TEST%'")).rows[0].n
const bad = rows.filter((r) => /^(R[1-3567]|U2)_/.test(r.rule_key) && r.last_test_result !== '통과')
if (bad.length || left) { console.error('FAIL', bad, left); process.exit(1) }
console.log('PASS')

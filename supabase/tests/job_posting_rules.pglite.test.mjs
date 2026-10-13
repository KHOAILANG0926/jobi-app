// job_posting_rules 마이그레이션 + supabase/tests/job_posting_rules_test.sql 를 PGlite에서 사전 점검한다.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_posting_rules.pglite.test.mjs
// 한계: 로컬 흉내 DB다. 진짜 시험은 병합 후 Actions가 운영 DB에서 같은 SQL로 돌린다.
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
create table public.local_jobs (id bigint generated always as identity primary key, title text not null, company text not null,
  category text default 'other', salary text, employer_phone text, description text, active boolean default true,
  origin text not null default 'legacy', admin_hidden boolean not null default false, source_url text, images jsonb,
  industrial_park text, contact_zalo text, policy_decision text);
grant all on public.local_jobs to service_role; grant usage on schema public to service_role;
`)
await db.exec(f('../migrations/20261012153000_job_posting_policy_db_enforcement.sql'))
await db.exec(f('../migrations/20261013100000_job_posting_rules.sql'))
await db.exec(f('../migrations/20261013100000_job_posting_rules.sql')) // 멱등성
await db.exec(f('./job_posting_rules_test.sql'))
const rows = (await db.query('select rule_key,last_test_result from job_posting_rules order by id')).rows
console.table(rows)
const left = (await db.query("select count(*)::int n from local_jobs where title like '[RULE-TEST%'")).rows[0].n
const bad = rows.filter((r) => /^R[1-3567]_/.test(r.rule_key) && r.last_test_result !== '통과')
if (bad.length || left) { console.error('FAIL', bad, left); process.exit(1) }
console.log('PASS')

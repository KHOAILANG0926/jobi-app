// 20261014100000_local_jobs_column_privileges.sql 사전 점검(PGlite). 열 단위 권한 + 기존 RLS(게스트 insert 정책)가 함께 동작하는지 본다.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/local_jobs_column_privileges.pglite.test.mjs
// 한계: 로컬 흉내 DB. 진짜 확인은 병합 후 Actions가 운영 DB에서 같은 점검 SQL을 돌린다(job-rules-apply.yml).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
create table public.local_jobs (id bigint generated always as identity primary key, title text not null, company text not null,
  active boolean default true, admin_hidden boolean not null default false, employer_id uuid, origin text default 'legacy',
  guest_manage_token text, source_url text, source_text text, ocr_text text, ocr_check jsonb, images jsonb);
alter table public.local_jobs enable row level security;
create policy pub_read on public.local_jobs for select to anon, authenticated using (active and not admin_hidden);
create policy local_jobs_guest_insert on public.local_jobs for insert to anon
  with check (employer_id is null and guest_manage_token is not null and length(guest_manage_token) >= 20);
-- 운영과 같은 출발 상태: 테이블 단위 SELECT + 열 REVOKE(효과 없음) + anon INSERT
grant select on public.local_jobs to anon, authenticated; grant insert on public.local_jobs to anon;
revoke select (guest_manage_token) on public.local_jobs from anon, authenticated;
grant all on public.local_jobs to service_role;
insert into public.local_jobs (title, company, guest_manage_token, source_url, source_text) values ('t','c', repeat('z',24), 'https://x', 'raw');
`)
const as = async (role, sql) => { await db.exec(`set role ${role}`); try { return await db.query(sql) } finally { await db.exec('reset role') } }
const denied = async (role, sql, m) => { try { await as(role, sql); assert.fail(m + ' — 막혀야 하는데 읽힘') } catch (e) { assert.match(e.message, /permission denied/, m) } }

// 이전 상태 재현: 마이그레이션 전에는 anon이 토큰을 읽는다(기존 구멍)
assert.equal((await as('anon', 'select guest_manage_token from public.local_jobs')).rows.length, 1, '마이그레이션 전: 토큰 노출 재현')

const mig = readFileSync(new URL('../migrations/20261014100000_local_jobs_column_privileges.sql', import.meta.url), 'utf8')
await db.exec(mig); await db.exec(mig) // 멱등

for (const role of ['anon', 'authenticated']) {
  for (const col of ['source_url', 'source_text', 'ocr_text', 'ocr_check', 'guest_manage_token']) await denied(role, `select ${col} from public.local_jobs`, `${role}.${col}`)
  await denied(role, 'select * from public.local_jobs', `${role} select *`)
  const ok = await as(role, 'select id,title,company,active,admin_hidden,employer_id,origin,images from public.local_jobs')
  assert.equal(ok.rows.length, 1, `${role} 공개 열 조회`)
}
// 게스트 등록(anon insert, 정책이 guest_manage_token을 본다) + 공개 열만 돌려받기
const ins = await as('anon', `insert into public.local_jobs (title, company, guest_manage_token) values ('g','gc', repeat('a',24)) returning id,title`)
assert.equal(ins.rows.length, 1, '게스트 insert + 공개 열 returning')
await denied('anon', `insert into public.local_jobs (title, company, guest_manage_token) values ('g','gc', repeat('a',24)) returning guest_manage_token`, '게스트 insert returning 토큰')
// service_role(크롤러·서버)은 그대로 전부 읽는다
assert.equal((await as('service_role', 'select guest_manage_token, source_url, source_text, ocr_text, ocr_check from public.local_jobs')).rows.length, 2, 'service_role 전부')
console.log('local_jobs column privileges: all assertions passed')

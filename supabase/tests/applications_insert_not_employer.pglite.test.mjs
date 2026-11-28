// 20261128060000_applications_insert_not_employer.sql 사전 점검(PGlite, 운영 DB 접속 없음) — 대표 2026-11-28 지시 3.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/applications_insert_not_employer.pglite.test.mjs
// 운영 정책(20260920043000)과 같은 조건의 '이전 정책'을 먼저 만들어 기업 계정 지원이 저장되는 구멍을 보인 뒤, 새 migration 파일을 그대로 적용해 실제 저장해 본다:
//  ① 구직자 정상 지원 성공 ② 기업 계정 지원 거절(자기 공고·다른 기업 공고 모두) ③ 기존 조건(남의 이름·위조 기업·정지 계정·역할 줄 없는 계정 지원) 그대로 ④ 기업이 지원자를 보는 정책은 그대로
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const mig = readFileSync(new URL('../migrations/20261128060000_applications_insert_not_employer.sql', import.meta.url), 'utf8')
const db = new PGlite()
const S1 = '00000000-0000-0000-0000-0000000000a1', S2 = '00000000-0000-0000-0000-0000000000a2', S3 = '00000000-0000-0000-0000-0000000000a3', NOROLE = '00000000-0000-0000-0000-0000000000a4'
const E1 = '00000000-0000-0000-0000-0000000000b1', E2 = '00000000-0000-0000-0000-0000000000b2'
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.account_roles (user_id uuid primary key, role text not null);
alter table public.account_roles enable row level security;
create policy account_roles_select_own on public.account_roles for select to authenticated using (user_id = auth.uid());
create table public.account_status (user_id uuid primary key, active boolean not null);
create function public.is_account_active(uid uuid) returns boolean language sql stable security definer as $$ select coalesce((select active from public.account_status where user_id = uid), true) $$;
create table public.local_jobs (id bigint generated always as identity primary key, employer_id uuid);
create table public.applications (id bigint generated always as identity primary key, job_id bigint not null references public.local_jobs(id), seeker_id uuid not null, employer_id uuid, status text not null default 'submitted');
alter table public.applications enable row level security;
create policy applications_select on public.applications for select to authenticated using (seeker_id = auth.uid() or employer_id = auth.uid());
create policy applications_insert on public.applications for insert with check (
  is_account_active(auth.uid()) and seeker_id = auth.uid() and status = 'submitted'
  and exists (select 1 from local_jobs l where l.id = applications.job_id and l.employer_id is not null and l.employer_id = applications.employer_id));
grant select, insert on public.applications to authenticated; grant select on public.account_roles, public.local_jobs to authenticated;
insert into public.account_roles values ('${S1}','seeker'),('${S2}','seeker'),('${S3}','seeker'),('${E1}','employer'),('${E2}','employer');
insert into public.account_status values ('${S3}', false);
insert into public.local_jobs(employer_id) values ('${E1}'), ('${E2}');
`)
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false)`); try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`) } }
const apply = (uid, job, emp, seeker = uid) => as(uid, () => db.query(`insert into public.applications(job_id, seeker_id, employer_id) values ($1,$2,$3)`, [job, seeker, emp]).then(() => 'ok', (e) => String(e.message).includes('row-level security') ? 'rls' : 'err:' + e.message))
const count = async () => (await db.query(`select count(*)::int c from public.applications`)).rows[0].c

// 적용 전(운영 정책과 같은 조건): 기업 계정의 지원이 저장된다(구멍)
assert.equal(await apply(E1, 1, E1), 'ok', '적용 전: 기업 계정(자기 공고) 지원이 저장됨')
assert.equal(await apply(E2, 1, E1), 'ok', '적용 전: 기업 계정(다른 기업 공고) 지원이 저장됨')
await db.exec(`delete from public.applications`)

await db.exec(mig)
assert.equal(await apply(S1, 1, E1), 'ok', '① 구직자 정상 지원 성공')
assert.equal(await apply(S2, 2, E2), 'ok', '① 다른 구직자·다른 기업 공고 정상 지원')
assert.equal(await apply(E1, 1, E1), 'rls', '② 기업 계정 자기 공고 지원 거절')
assert.equal(await apply(E2, 1, E1), 'rls', '② 기업 계정 다른 기업 공고 지원 거절')
assert.equal(await count(), 2, '② 거절된 지원은 저장되지 않음')
assert.equal(await apply(S1, 2, E2, S2), 'rls', '③ 남의 이름으로 지원 거절(기존 조건)')
assert.equal(await apply(S1, 2, E1), 'rls', '③ 위조한 기업 번호로 지원 거절(기존 조건)')
assert.equal(await apply(S3, 1, E1), 'rls', '③ 정지 계정 지원 거절(기존 조건)')
assert.equal(await apply(NOROLE, 1, E1), 'ok', '③ 역할 줄이 없는 계정의 지원은 그대로(기존 동작 유지)')
const seen = await as(E1, () => db.query(`select count(*)::int c from public.applications`)).then((r) => r.rows[0].c)
assert.equal(seen, 2, '④ 기업은 자기 공고의 지원자(2건: S1·역할없음)를 계속 봄')
console.log('applications_insert_not_employer: seeker apply ok, employer apply denied, existing conditions kept')

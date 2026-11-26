// 실제 PostgreSQL 동시 요청 시험 도우미(통합 운영 정상화 J그룹 2순위, Lee 2026-11-26). 운영 DB 접속 없음 — PG_TEST_URL(폐기용 DB) 안에 시험용 DB를 새로 만들고 지운다.
// 연결 하나 = psql 프로세스 하나(진짜 서버 연결). 여러 연결이 서로 기다리는지(DB 잠금)를 pg_stat_activity로 확인하므로 PGlite(연결 1개)로는 못 하는 시험이다.
// npm 모듈 없이 psql만 쓴다(migration-postgres 잡에 이미 설치됨).
// 시험 대상 함수·정책·권한·트리거는 migration 파일에서 글자 그대로 읽어 올린다(대역을 새로 쓰지 않는다). 운영 본 DB 이전 기반 표(local_jobs 등)만 시험용 구조로 만든다 — 아래 BASELINE.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

export const mig = (f) => readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8')
// 파일에서 start 줄부터 end 패턴 끝까지 글자 그대로 잘라 온다(못 찾으면 시험 실패 — 조용히 대역으로 바뀌지 않는다).
export function grab(text, start, end) {
  const i = text.search(start)
  assert.ok(i >= 0, `migration에서 ${start}를 찾지 못함`)
  const rest = text.slice(i)
  const m = rest.match(end)
  assert.ok(m, `migration에서 ${end}를 찾지 못함`)
  return rest.slice(0, m.index + m[0].length)
}

export const repoFile = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8')

export const IDS = {
  E1: '11111111-1111-1111-1111-111111111111', E2: '22222222-2222-2222-2222-222222222222',
  S1: '33333333-3333-3333-3333-333333333333', S2: '44444444-4444-4444-4444-444444444444',
  S3: '66666666-6666-6666-6666-666666666666', ADM: '55555555-5555-5555-5555-555555555555',
}

function withDb(url, db) { return url.replace(/^(postgres(?:ql)?:\/\/[^/]*\/)[^?]*/, `$1${db}`) }

// 연결 하나. run()은 문장을 보내고 결과 글자(오류 포함)를 돌려주는 약속 — 잠금으로 막히면 약속이 안 끝난다(그 자체가 시험 대상).
export class Sess {
  constructor(url, name) {
    this.name = name; this.buf = ''; this.waiters = []; this.n = 0
    this.proc = spawn('sh', ['-c', 'exec psql "$PGURL" -X -q -At 2>&1'], { env: { ...process.env, PGURL: url } })
    this.proc.stdout.on('data', (d) => { this.buf += d; this.drain() })
  }
  drain() {
    while (this.waiters.length) {
      const w = this.waiters[0]; const i = this.buf.indexOf(w.mark)
      if (i < 0) return
      this.waiters.shift(); const out = this.buf.slice(0, i); this.buf = this.buf.slice(i + w.mark.length).replace(/^\r?\n/, ''); w.res(out)
    }
  }
  run(sql) {
    const mark = `__END_${this.name}_${++this.n}__`
    // psql은 ';' 없이 끝난 문장을 다음 입력과 붙여 버린다 — 빠지면 붙여서 한 문장씩 실제로 실행되게 한다(commit·rollback을 ';' 없이 써도 안전)
    const body = /(;|\\gset)\s*$/.test(sql) ? sql : `${sql};`
    return new Promise((res) => { this.waiters.push({ mark, res }); this.proc.stdin.write(`${body}\n\\echo ${mark}\n`) })
  }
  async pid() { return Number((await this.run('select pg_backend_pid();')).trim().split('\n').pop()) }
  // 역할·로그인 사용자로 트랜잭션 시작(Supabase와 같은 방식: 역할 전환 + auth.uid()가 읽는 설정값)
  // 요청 역할(anon·authenticated·service_role)은 Supabase와 같은 연결 구조로 만든다: 로그인 역할 authenticator로 들어와 요청 역할로 바뀐다 → session_user=authenticator.
  // (예전에는 세션 사용자가 시험 계정 그대로라 session_user로 호출자를 보는 확인이 실제와 다르게 통과했다 — job_duplicate_decide 수정 시험에서 발견.)
  async begin(role, sub, claims) {
    let q = `begin;${['anon', 'authenticated', 'service_role'].includes(role) ? ' set local session authorization authenticator;' : ''} set local role ${role};`
    if (sub) q += ` select set_config('request.jwt.claim.sub', '${sub}', true) as x \\gset\n`
    if (claims) q += ` select set_config('request.jwt.claims', '${JSON.stringify(claims)}', true) as y \\gset\n`
    return this.run(q)
  }
  close() { this.proc.stdin.end(); this.proc.kill() }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 약속이 ms 안에 끝나면 [값], 못 끝나면 null — 끝나지 않으면 DB 잠금에 막힌 것으로 본다(그때 admin으로 실제 잠금 대기를 확인).
export const settled = (p, ms = 1500) => Promise.race([p.then((v) => [v]), sleep(ms).then(() => null)])
export const isErr = (out) => /ERROR:/.test(out)
export const lastNum = (out) => Number(out.trim().split('\n').filter(Boolean).pop())
export const errText = (out) => (out.match(/ERROR:.*/) || [''])[0]

// 시험용 DB: BASELINE(운영 이전 기반 표의 시험용 구조) + migration 파일에서 글자 그대로 읽은 함수·정책·권한·트리거.
export async function makeScratch() {
  const base = process.env.PG_TEST_URL
  assert.ok(base, 'PG_TEST_URL(폐기용 DB) 필요')
  const name = `jobi_race_${process.pid}_${Date.now()}`
  const admin = (url, sql) => {
    const r = spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8' })
    assert.equal(r.status, 0, `psql 실패: ${r.stderr}`)
    return r.stdout
  }
  admin(base, `create database ${name}`)
  const url = withDb(base, name)

  const one = mig('20261029010000_ingest_one_door.sql')
  const gateway = mig('20261028160000_ingest_gateway.sql')
  const ops = mig('0009_admin_operations.sql')
  const pubgate = mig('20261101190000_db_publish_gate.sql')
  const guest = mig('20260920120000_local_jobs_guest_posting.sql')
  const appsFix = mig('20260920043000_fix_applications_insert_employer_check.sql')
  const apps1 = mig('0001_applications.sql')
  const posting = mig('20261013100000_job_posting_rules.sql')
  const refloc = repoFile('scripts/ci/reference-location-fixed.sql')
  const dedup = mig('20261108000000_agency_workplace_dedup.sql')
  const colpriv = mig('20261014100000_local_jobs_column_privileges.sql')
  const stmt = /;\s*\n/

  admin(url, `
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
alter role service_role bypassrls; -- Supabase와 같게(다른 시험 fixture가 먼저 만든 역할이어도)
do $r$ begin if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator nologin; end if; end $r$;
grant anon, authenticated, service_role to authenticator;
-- Supabase 기본 설정과 같게: public에 새로 만든 함수는 anon·authenticated·service_role이 실행 가능(migration이 revoke 한 것만 막힘)
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table auth.users (id uuid primary key);
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- BASELINE: 운영에 이 repo의 migration보다 먼저 있던 표의 시험용 구조(migration 전체를 처음부터 다시 돌릴 수 없어서 — 기반 표와 PostGIS가 repo 밖).
create table public.account_statuses (user_id uuid primary key references auth.users(id), status text not null default 'active');
create table public.account_roles (user_id uuid primary key references auth.users(id), role text not null);
alter table public.account_roles enable row level security;
create policy account_roles_self_select on public.account_roles for select to authenticated using (user_id = auth.uid());
grant select on public.account_roles to authenticated;
create table public.local_jobs (
  id bigint generated always as identity primary key,
  title text, company text, category text, salary text, location text, hours text, employer_phone text, contact_zalo text,
  application_deadline date, urgent boolean, description text, lat double precision, lng double precision,
  active boolean not null default true, image_url text, work_period text, work_days text, education text, preference text,
  num_hires text, company_verified boolean, company_founded_year int, hire_count int, images jsonb,
  recruitment_regions jsonb, source_url text, source_text text, origin text not null default 'crawler', admin_hidden boolean not null default false,
  employer_id uuid references auth.users(id), occupation_code text, publish_gate_reason text, policy_decision text, ocr_text text, ocr_check jsonb,
  crawler_version text, last_verified_at timestamptz, guest_manage_token text, posted_at date, created_at timestamptz default now(), updated_at timestamptz default now());
alter table public.local_jobs enable row level security;
create extension if not exists unaccent;
create table public.job_work_locations (id bigint generated always as identity primary key, job_id bigint not null references public.local_jobs(id) on delete cascade, raw_address text not null default '', normalized_address text, unique (job_id, normalized_address));
create schema dedupe_private;
create table public.admin_audit_logs (id bigint generated always as identity primary key, admin_user_id uuid, action text, target_type text, target_id text, metadata jsonb);
-- 시험용 대역 1: 입구가 근무지를 저장하는 함수(운영은 위치 원본 DB 함수 — 이 시험의 대상이 아님). 근무지 행(정규화 주소는 운영과 같은 admin_location_key)을 넣고, 항목에 fail:true가 있으면 실패해 '저장 도중 실패' 때의 되돌림을 본다.
create function public.replace_job_work_locations(p_job bigint, p_rows jsonb) returns void language plpgsql security definer set search_path = pg_catalog, public as $f$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce((r->>'fail')::boolean, false) then raise exception 'test double: forced failure'; end if;
    insert into public.job_work_locations(job_id, raw_address, normalized_address) values (p_job, r->>'raw_address', public.admin_location_key(r->>'raw_address'));
  end loop;
end $f$;
-- 시험용 대역 2: preflight 통과용 옛 입구(실제 migration이 바로 대체한다)
create function public.ingest_job(p jsonb) returns bigint language sql as $f$ select 0::bigint $f$;
-- 글자 그대로 읽은 운영 정의
${grab(posting, /create or replace function public\.job_phone_digits/, /\$f\$;/)}
${grab(refloc, /create or replace function public\.admin_location_key/, /\$\$;/)}
${grab(dedup, /create or replace function dedupe_private\.verdict/, /\nend \$\$;/)}
${grab(guest, /create or replace function public\.get_guest_job/, /grant execute on function public\.get_guest_job[^\n]*;/)}
${grab(guest, /create or replace function public\.update_guest_job/, /grant execute on function public\.update_guest_job[^\n]*;/)}
${grab(ops, /create or replace function public\.is_account_active/, /\$\$;/)}
${grab(ops, /create or replace function public\.is_admin/, /\$\$;/)}
${grab(gateway, /create table public\.job_ingest_raw/, stmt)}
alter table public.job_ingest_raw enable row level security;
${grab(gateway, /create table public\.job_ingest_log/, /\n\);/)}
${grab(ops, /drop policy if exists local_jobs_public_select/, stmt)}
${grab(ops, /drop policy if exists local_jobs_employer_insert/, stmt)}
${grab(ops, /drop policy if exists local_jobs_employer_update/, stmt)}
${grab(ops, /drop policy if exists local_jobs_employer_delete/, stmt)}
${grab(ops, /create policy local_jobs_public_select/, stmt)}
${grab(ops, /create policy local_jobs_employer_insert/, stmt)}
${grab(ops, /create policy local_jobs_employer_update/, stmt)}
${grab(ops, /create policy local_jobs_employer_delete/, stmt)}
${grab(ops, /revoke all privileges on table public\.local_jobs/, /\) on table public\.local_jobs to authenticated;/)}
${grab(guest, /create policy local_jobs_guest_insert/, stmt)}
grant insert on public.local_jobs to anon;
${grab(guest, /revoke select \(guest_manage_token\)/, /;\s*\n/)}
${colpriv} -- 운영의 열 단위 읽기 권한(원문 주소·원문·관리 토큰 등은 anon·authenticated가 못 읽음) 그대로
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.local_jobs(id),
  seeker_id uuid not null references auth.users(id),
  employer_id uuid not null references auth.users(id),
  job_title text, company text, seeker_name text, seeker_phone text,
  status text not null default 'submitted', status_history jsonb not null default '[]', applied_at timestamptz not null default now(),
  unique (job_id, seeker_id),
  constraint applications_status_check check (status in ('submitted', 'reviewing', 'interview', 'accepted', 'rejected')));
alter table public.applications enable row level security;
${grab(apps1, /revoke all privileges on table public\.applications/, /grant update \(status, status_history\) on table public\.applications to authenticated;/)}
${grab(ops, /create policy applications_select/, stmt)}
${grab(appsFix, /create policy applications_insert on applications/, stmt).replace('on applications', 'on public.applications').replace(/local_jobs l\b/, 'public.local_jobs l').replace('from local_jobs', 'from public.local_jobs').replace('is_account_active(', 'public.is_account_active(')}
${grab(ops, /create policy applications_update_by_employer/, stmt)}
${grab(ops, /create policy applications_delete_by_seeker/, stmt)}
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to anon, authenticated, service_role;
insert into auth.users(id) values ('${IDS.E1}'), ('${IDS.E2}'), ('${IDS.S1}'), ('${IDS.S2}'), ('${IDS.S3}'), ('${IDS.ADM}');
insert into public.account_statuses(user_id, status) values ('${IDS.E1}','active'), ('${IDS.E2}','active'), ('${IDS.S1}','active'), ('${IDS.S2}','active'), ('${IDS.S3}','suspended'), ('${IDS.ADM}','active');
insert into public.account_roles(user_id, role) values ('${IDS.E1}','employer'), ('${IDS.E2}','employer'), ('${IDS.S1}','seeker'), ('${IDS.S2}','seeker'), ('${IDS.S3}','seeker');
`)
  // 운영 정의 그대로: 입구(ingest_job)·비공개 도우미·입구 전용 트리거(20261029010000 전체), 공개 판정 함수·트리거(20261101190000)
  admin(url, one)
  admin(url, mig('20261124000000_branch_job_identity.sql')) // 지점별 독립 공고 식별자(운영에 이미 적용된 본문과 같은 구조 — 입구 해시·find_existing 7자리·중복 판정)
  admin(url, grab(pubgate, /create or replace function public\.job_publish_gate_reason/, /for each row execute function public\.enforce_job_publish_gate\(\);/))
  return {
    url,
    admin: (sql) => admin(url, sql),
    // 한 줄 결과 조회(읽기)
    scalar: (sql) => admin(url, `\\pset tuples_only on\n\\pset format unaligned\n${sql}`).trim().split('\n').filter(Boolean).pop(),
    sess: (name) => new Sess(url, name),
    // 다른 연결이 잠금 때문에 기다리는지(pg_stat_activity wait_event_type='Lock') — 시험이 '실제로 막혔다'를 증거로 확인
    isWaiting: (pid) => admin(url, `select 1 from pg_stat_activity where pid = ${pid} and wait_event_type = 'Lock'`).includes('1'),
    drop: () => { try { admin(base, `drop database ${name} with (force)`) } catch {} },
  }
}

export const jobPayload = (tag, o = {}) => ({
  channel: 'employer', source_text: `원문 ${tag}`, company: `CTY ${tag}`, employer_phone: '0912345678', title: `t-${tag}`,
  location: 'KCN Yên Phong, Bắc Ninh', active: true, ...o,
})
export const callSql = (p) => `select public.ingest_job($j$${JSON.stringify(p)}$j$::jsonb);`

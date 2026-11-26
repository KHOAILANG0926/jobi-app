// 실제 migration 전체를 처음부터 순서대로 시험용 DB에 적용하는 도우미(통합 운영 정상화 2·3순위 DB 검증, Lee 2026-11-26). 운영 DB 접속 없음.
// pg-race.mjs의 makeScratch는 '필요한 함수만 파일에서 읽어 올리는' 방식이라 위치 저장 함수·직업분류·중복 보류 트리거가 대역이거나 빠져 있었다 —
// 여기서는 migration 파일을 시각 순서대로 한 파일씩(psql -1, 운영 migrations-apply와 같은 한 파일=한 트랜잭션) 그대로 적용하고,
// 못 올라간 파일은 이유와 함께 기록한다(조용히 대역으로 바꾸지 않는다). 시험이 요구하는 핵심 객체가 빠지면 시험이 실패한다.
// 시험용 구조로 바꾼 것(운영과 다른 점)은 아래 BASE·REWRITE 두 곳뿐이다:
//  · BASE: 운영에 이 repo의 migration보다 먼저 있던 표·역할·확장(local_jobs 기반 열, auth, 공개 발행 설정). 운영 이전 구조는 repo 밖이다.
//  · REWRITE: PostGIS가 없는 시험 서버(CI의 postgres:16)용으로 0010의 geography 생성 열과 확장 생성만 뺀다(그 열은 위치 저장 함수가 쓰지 않음).
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { IDS, Sess, mig, ensurePgServer } from './pg-race.mjs'

const dir = new URL('../../migrations/', import.meta.url)
const pendingDir = new URL('../../pending/', import.meta.url)
// 운영엔 적용됐지만 migrations/로 옮겨지지 않은 승인 대기 SQL 2개(research_artifacts·vietmap_usage / MAP-R1) — 운영 구조 대조로 확인(#1070). 버전 순서에 끼워 넣는다(앞 8~14자리 + 0 채움).
const PENDING_APPLIED = ['20261008000000_private_research_store.sql', '20261015_map_r1_auto_location.sql']

export const BASE = `
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
alter role service_role bypassrls;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
-- Supabase 기본 설정: public에 새로 만든 표·순서도 세 역할에 모두 열려 있고, migration이 revoke 한 것만 닫힌다
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create extension if not exists unaccent;
create extension if not exists pgcrypto;
create publication supabase_realtime;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create schema extensions;
-- 운영의 Supabase 기능 대역(시험 대상 아님): 저장소 폴더 이름 함수, pg_net/pg_cron(확장 생성 줄은 REWRITE_ALL이 뺌)
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create schema net; create function net.http_post(url text, body jsonb default null, params jsonb default null, headers jsonb default null, timeout_milliseconds int default 1000) returns bigint language sql as $$ select 0::bigint $$;
create schema cron; create function cron.schedule(a text, b text, c text default null) returns bigint language sql as $$ select 0::bigint $$;
create table net._http_response (id bigint primary key, status_code integer, content text, created timestamptz default now());
create table cron.job (jobid bigint generated always as identity primary key, jobname text, schedule text, command text, active boolean default true);
create function cron.unschedule(a bigint) returns boolean language sql as $$ select true $$;
create function cron.unschedule(a text) returns boolean language sql as $$ select true $$;
create schema vault; create table vault.secrets (id uuid primary key default gen_random_uuid(), name text, secret text); create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text, n text default null, d text default null) returns uuid language plpgsql as $$ declare i uuid; begin insert into vault.secrets(name, secret) values (n, s) returning id into i; return i; end $$;
${readFileSync(new URL('../baseline/local_jobs_base.sql', import.meta.url), 'utf8')}`

// 파일별 글자 바꿈(이 두 가지만): PostGIS 확장·geography 생성 열
export const REWRITE = {
  '0010_job_work_locations.sql': (t) => {
    const a = t.indexOf('create extension if not exists postgis;')
    assert.ok(a >= 0, '0010: postgis 줄을 찾지 못함')
    t = t.replace('create extension if not exists postgis;', '-- (시험 서버에 PostGIS 없음 — pg-chain.mjs REWRITE)')
    const i = t.indexOf('  -- lat/lng가 둘 다 있을 때만 자동 계산되는 PostGIS geography 포인트.')
    const j = t.indexOf(') stored,', i)
    assert.ok(i >= 0 && j > i, '0010: geog 열을 찾지 못함')
    t = t.slice(0, i) + t.slice(j + ') stored,'.length)
    const k = t.indexOf('create index if not exists idx_job_work_locations_geog')
    assert.ok(k >= 0, '0010: geog 색인을 찾지 못함')
    return t.slice(0, k) + t.slice(t.indexOf(';', k) + 1)
  },
}

// 모든 파일 공통: pg_net·pg_cron 확장 생성 줄만 뺀다(위 대역 스키마로 대체)
export const REWRITE_ALL = (t) => t.replace(/create extension if not exists (?:pg_net|pg_cron)[^;]*;/g, '-- (시험 서버에 없는 확장 — pg-chain.mjs REWRITE_ALL)')
const run = (url, sql, opts = []) => spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...opts, '-f', '-'], { input: sql, encoding: 'utf8' })


// 저장소 migration 전체를 파일 이름 순서로 한 파일씩 한 트랜잭션으로 올린다(운영 migrations-apply와 같은 방식). 실패한 파일은 나머지를 다 올린 뒤 한 번 더 시도한다 —
// 파일 이름 순서와 실제 의존 순서가 어긋난 경우(예: 20261107172459는 20261107180000 뒤에 있어야 함)를 같은 방법으로 처리. 그래도 실패하면 failed에 남는다.
// rewrite=false는 PostGIS·pg_net·pg_cron이 실제로 있는 서버(Supabase 로컬 스택)용 — 글자 바꿈 없이 원문 그대로 적용한다.
export function applyMigrations(url, { only, rewrite = true } = {}) {
  const applied = [], failed = []
  const entries = [
    ...readdirSync(dir).filter((x) => x.endsWith('.sql')).map((f) => ({ f, u: new URL(f, dir) })),
    ...PENDING_APPLIED.map((f) => ({ f, u: new URL(f, pendingDir) })),
  ].sort((a, b) => (a.f.split('_')[0].padEnd(14, '0') + a.f).localeCompare(b.f.split('_')[0].padEnd(14, '0') + b.f))
  const tryFile = ({ f, u }) => {
    let text = readFileSync(u, 'utf8')
    if (rewrite) { if (REWRITE[f]) text = REWRITE[f](text); text = REWRITE_ALL(text) }
    return run(url, text, ['-1'])
  }
  const retry = []
  for (const e of entries) {
    if (only && !only(e.f)) continue
    const r = tryFile(e)
    if (r.status === 0) applied.push(e.f); else retry.push([e, r])
  }
  for (const [e, r0] of retry) {
    const r = tryFile(e)
    if (r.status === 0) applied.push(e.f); else failed.push([e.f, (r0.stderr.match(/ERROR:.*/) || [r0.stderr.slice(0, 120)])[0]])
  }
  return { applied, failed }
}

export async function makeChain({ only } = {}) {
  const base = process.env.PG_TEST_URL
  assert.ok(base, 'PG_TEST_URL(폐기용 DB) 필요')
  ensurePgServer()
  const name = `jobi_chain_${process.pid}_${Date.now()}`
  // location_single_source가 만드는 역할 location_writer는 서버 전체(데이터베이스 밖) 객체라 앞선 시험이 남긴 것이 있으면 migration이 거부한다 — 같은 서버에서 시험을 차례로 돌리므로(동시에 둘 아님) 먼저 치운다
  spawnSync('psql', [base, '-X', '-q', '-c', 'drop role if exists location_writer'], { encoding: 'utf8' })
  const adm = spawnSync('psql', [base, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', `create database ${name}`], { encoding: 'utf8' })
  assert.equal(adm.status, 0, adm.stderr)
  const url = base.replace(/^(postgres(?:ql)?:\/\/[^/]*\/)[^?]*/, `$1${name}`)
  const b = run(url, BASE); assert.equal(b.status, 0, `BASE 적용 실패: ${b.stderr}`)
  const { applied, failed } = applyMigrations(url, { only })
  return {
    url, applied, failed,
    admin: (sql) => { const r = run(url, sql); assert.equal(r.status, 0, `psql 실패: ${r.stderr}`); return r.stdout },
    scalar: (sql) => { const r = run(url, `\\pset tuples_only on\n\\pset format unaligned\n${sql}`); assert.equal(r.status, 0, `psql 실패: ${r.stderr}`); return r.stdout.trim().split('\n').filter(Boolean).pop() },
    sess: (n) => new Sess(url, n),
    isWaiting: (pid) => run(url, `select 1 from pg_stat_activity where pid = ${pid} and wait_event_type = 'Lock'`).stdout.includes('1'),
    has: (sql) => run(url, `select 1 where ${sql}`).stdout.includes('1'),
    drop: () => { try { spawnSync('psql', [base, '-X', '-q', '-c', `drop database ${name} with (force)`]); spawnSync('psql', [base, '-X', '-q', '-c', 'drop role if exists location_writer']) } catch {} },
  }
}
export { IDS, mig }

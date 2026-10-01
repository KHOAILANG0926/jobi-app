// supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql 의 SQL 로직 검증(PGlite).
//
// 실행(저장소 의존성에 추가하지 않음 — 일회성 설치):
//   npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_conditions_pins.pglite.test.mjs
//
// 한계: auth.uid()/역할은 최소 흉내, local_jobs/job_work_locations 는 필요한 컬럼만 재구성.
// 실제 환경은 적용 후 카탈로그·API 확인으로 보완한다.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIG = new URL('../migrations/20261001100601_local_jobs_work_conditions_and_pins.sql', import.meta.url)
const db = new PGlite()
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('✅', m) } else { fail++; console.log('❌', m) } }
async function expectError(sql, m) { try { await db.exec(sql); ok(false, m) } catch (e) { ok(true, `${m} (${e.message.split('\n')[0]})`) } }
const q = async (sql) => (await db.query(sql)).rows

const TOKEN = 'guest-token-abcdefghijklmnop'
const EMP = '00000000-0000-0000-0000-0000000000e1'
const OTHER = '00000000-0000-0000-0000-0000000000e2'
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
create table public.local_jobs (id bigint primary key, title text, employer_id uuid, guest_manage_token text, urgent boolean default false,
  shift_type text check (shift_type is null or shift_type in ('day','night','rotating','other')));
create table public.job_work_locations (id bigint generated always as identity primary key, job_id bigint references public.local_jobs(id) on delete cascade,
  raw_address text not null, normalized_address text, lat double precision, lng double precision, geocode_status text, geocode_source text,
  location_verified boolean default false, sort_order int default 0, address_accuracy text, coordinate_accuracy text,
  unique (job_id, normalized_address));
create function public.is_account_active(user_id uuid) returns boolean language sql stable as $$ select true $$;
grant usage on schema public to anon, authenticated;
grant select, insert on public.local_jobs to anon, authenticated;
grant select on public.job_work_locations to anon, authenticated;
insert into auth.users values ('${EMP}'), ('${OTHER}');
insert into public.local_jobs(id, title, employer_id, guest_manage_token) values
  (1, 'guest job', null, '${TOKEN}'), (2, 'employer job', '${EMP}', null), (3, 'crawled job', null, null);
insert into public.job_work_locations(job_id, raw_address, lat, lng, location_verified) values (3, 'crawled addr', 21.1, 106.1, true);
`)
await db.exec(readFileSync(MIG, 'utf8'))
ok(true, 'migration applied')

const ANON = `set role anon; select set_config('request.jwt.claim.sub','',false);`
const AS = (u) => `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false);`

// 새 컬럼은 NULL(미확인)로 시작 — backfill 없음
await db.exec('reset role')
const fresh = (await q(`select shuttle_bus, dormitory, meal_provided, immediate_start, recruitment_type, work_schedule, weekend_work from public.local_jobs where id = 3`))[0]
ok(Object.values(fresh).every((v) => v === null), 'existing rows keep NULL for all new columns')
await expectError(`update public.local_jobs set recruitment_type = 'maybe' where id = 3`, 'recruitment_type check rejects unknown value')
await expectError(`update public.local_jobs set work_schedule = '7_days' where id = 3`, 'work_schedule check rejects unknown value')

// 게스트: 토큰으로 핀·조건 설정 가능
await db.exec(ANON)
ok((await q(`select public.set_job_pinned_location(1, '${TOKEN}', 'KCN Quế Võ', 21.12, 106.15) as r`))[0].r === true, 'guest can set pin with token')
await expectError(`select public.set_job_pinned_location(1, 'wrong-token-xxxxxxxxxxxx', 'x', 21.1, 106.1)`, 'wrong token rejected')
await expectError(`select public.set_job_pinned_location(1, '${TOKEN}', 'x', 40.0, 106.1)`, 'out-of-Vietnam coordinates rejected')
await expectError(`select public.set_job_pinned_location(3, null, 'x', 21.1, 106.1)`, 'crawled job cannot be pinned via RPC')
await expectError(`select public.can_manage_local_job(1, '${TOKEN}')`, 'helper not directly callable by anon')
await q(`select public.update_job_conditions(1, '${TOKEN}', 'day', true, null, false, 'agency', true, '6_days', null)`)
await db.exec('reset role')
const pin = await q(`select lat, lng, location_verified, verification_method, geocode_source from public.job_work_locations where job_id = 1`)
ok(pin.length === 1 && pin[0].location_verified === true && pin[0].verification_method === 'poster_pin', 'pin stored as verified poster_pin')
const c1 = (await q(`select shift_type, shuttle_bus, dormitory, meal_provided, recruitment_type, immediate_start, work_schedule, weekend_work from public.local_jobs where id = 1`))[0]
ok(c1.shift_type === 'day' && c1.shuttle_bus === true && c1.dormitory === null && c1.meal_provided === false && c1.recruitment_type === 'agency' && c1.weekend_work === null,
  'conditions stored exactly (null stays null, false stays false)')

// 다시 핀 지정 → 기존 핀 교체(1개 유지), 해제 → 0개
await db.exec(ANON)
await q(`select public.set_job_pinned_location(1, '${TOKEN}', 'KCN Quế Võ 2', 21.13, 106.16)`)
await db.exec('reset role')
ok((await q(`select count(*)::int n from public.job_work_locations where job_id = 1`))[0].n === 1, 're-pin replaces previous pin')
await db.exec(ANON)
const got = await q(`select * from public.get_job_conditions(1, '${TOKEN}')`)
ok(got.length === 1 && got[0].pin_lat === 21.13 && got[0].recruitment_type === 'agency', 'get_job_conditions returns conditions + pin for owner')
ok((await q(`select * from public.get_job_conditions(1, 'wrong-token-xxxxxxxxxxxx')`)).length === 0, 'get_job_conditions returns nothing for non-owner')
await q(`select public.set_job_pinned_location(1, '${TOKEN}', null, null, null)`)
await db.exec('reset role')
ok((await q(`select count(*)::int n from public.job_work_locations where job_id = 1`))[0].n === 0, 'clearing pin removes poster_pin row')
ok((await q(`select count(*)::int n from public.job_work_locations where job_id = 3`))[0].n === 1, 'crawled job locations untouched')

// 로그인 고용주: 본인 공고만
await db.exec(AS(EMP))
ok((await q(`select public.set_job_pinned_location(2, null, 'Nhà máy', 21.0, 105.9) as r`))[0].r === true, 'employer can pin own job')
await q(`select public.update_job_conditions(2, null, null, null, null, null, 'direct', null, null, null)`)
await db.exec(AS(OTHER))
await expectError(`select public.set_job_pinned_location(2, null, 'x', 21.0, 105.9)`, 'other employer cannot pin')
await expectError(`select public.update_job_conditions(2, null, 'night', null, null, null, null, null, null, null)`, 'other employer cannot update conditions')
await db.exec('reset role')
ok((await q(`select recruitment_type from public.local_jobs where id = 2`))[0].recruitment_type === 'direct', 'employer conditions saved')

console.log(`\n결과: ${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)

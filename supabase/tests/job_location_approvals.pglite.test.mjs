// supabase/migrations/20260929120000_job_location_approvals.sql 의 SQL 로직 검증(PGlite).
//
// 실행(저장소 의존성에 추가하지 않음 — 일회성 설치):
//   npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_location_approvals.pglite.test.mjs
//
// ⚠️ 한계 — 이 테스트는 실제 Supabase 검증을 대신하지 않는다:
//   - auth.uid()/auth.jwt()/anon·authenticated 역할을 최소한으로 흉내 낸 것(아래 부트스트랩)이라
//     실제 Supabase Auth JWT 검증, PostgREST(API)의 컬럼 권한·RLS 적용 방식, supabase-js 호출은
//     확인하지 않는다.
//   - local_jobs/job_work_locations/admin_audit_logs/require_admin 은 필요한 컬럼만 재구성했다.
//   실제 환경 검증은 supabase/tests/job_location_approvals_post_apply.sql(카탈로그 확인)과
//   scripts/verify-location-approvals-api.mjs(anon API 확인) + 관리자 화면 수동 확인으로 보완한다.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIG = new URL('../migrations/20260929120000_job_location_approvals.sql', import.meta.url)
const db = new PGlite()
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('✅', m) } else { fail++; console.log('❌', m) } }
async function expectError(sql, m) { try { await db.exec(sql); ok(false, m) } catch (e) { ok(true, `${m} (${e.message.split('\n')[0]})`) } }

// ── 최소 부트스트랩(Supabase auth 흉내) ──
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
create table public.local_jobs (id bigint primary key, title text, company text, location text, active boolean default true, admin_hidden boolean default false);
create table public.job_work_locations (id bigint generated always as identity primary key, job_id bigint references public.local_jobs(id) on delete cascade, raw_address text not null);
create table public.admin_audit_logs (id bigint generated always as identity primary key, admin_user_id uuid not null references auth.users(id), action text not null, target_type text not null, target_id text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create function public.require_admin() returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare caller uuid := auth.uid();
begin
  if caller is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return caller;
end; $$;
grant usage on schema public to anon, authenticated;
grant select on public.local_jobs to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.local_jobs values (4453, 'Nhân Viên Khai Thác Hàng Hóa', 'Công Ty Cổ Phần Als Đông Hà Nội', 'Bắc Ninh'),
  (4682, 'TUYỂN DỤNG QUẢN LÝ DỰ ÁN', 'Nhà tuyển dụng Facebook', 'KCN VSIP, Bắc Ninh');
insert into public.job_work_locations(job_id, raw_address) values (4453, 'Số 10, đường 5, KCN VSIP Bắc Ninh, Phù Chẩn, Từ Sơn, Bắc Ninh, Từ Sơn');
`)
await db.exec(readFileSync(MIG, 'utf8'))
ok(true, 'migration applied')

const ADMIN = `set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false), set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',false);`
const USER = `set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false), set_config('request.jwt.claims','{}',false);`
const ANON = `set role anon; select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claims','{}',false);`
const q = async (sql) => (await db.query(sql)).rows

// 비관리자는 후보 추가·검토·목록 불가
await db.exec(USER)
await expectError(`select public.admin_add_location_candidate(4453, 'x', 21.07, 105.98, 'building', 'map_listing', 'e')`, 'non-admin cannot add candidate')
await expectError(`select * from public.admin_list_location_candidates()`, 'non-admin cannot list candidates')
await expectError(`insert into public.job_location_candidates(job_id, company_snapshot, address_snapshot, lat, lng, place_precision, source, evidence) values (4453,'a','b',21,106,'building','other','e')`, 'no direct insert privilege')

// 관리자: 공단 중심(area) 후보는 추가는 되지만 승인 불가
await db.exec(ADMIN)
const area = (await q(`select (public.admin_add_location_candidate(4682, 'KCN VSIP, Bắc Ninh', 21.0799208, 105.9807154, 'area', 'other', 'OSM 공단 중심점 — 회사 위치 아님')).id`))[0].id
await expectError(`select public.admin_review_location_candidate(${area}, 'approve', '')`, 'area-level candidate (industrial park center) cannot be approved')

// ALS 후보: 추가 → 승인 전 공개 조회 0건
const addr = 'Số 10, đường 5, KCN VSIP Bắc Ninh, Phù Chẩn, Từ Sơn, Bắc Ninh, Từ Sơn'
const als = (await q(`select (public.admin_add_location_candidate(4453, '${addr}', 21.0737738, 105.9806164, 'building', 'map_listing', 'als.com.vn 공식 주소 = 원문 = 구글 업체정보 주소', array['https://als.com.vn/ve-als/alse'])).id`))[0].id
await db.exec(ANON)
ok((await q(`select job_id from public.job_location_candidates`)).length === 0, 'before approval: public sees nothing')

// 승인 → 공개 조회 1건, 허용 컬럼만
await db.exec(ADMIN)
await q(`select public.admin_review_location_candidate(${als}, 'approve', '공식 주소와 업체정보 일치')`)
await db.exec(ANON)
const pub = await q(`select job_id, lat, lng, place_precision, company_snapshot, address_snapshot from public.job_location_candidates`)
ok(pub.length === 1 && pub[0].job_id == 4453 && pub[0].lat === 21.0737738, 'after approval: public sees the approved location')
await expectError(`select evidence from public.job_location_candidates`, 'public cannot read evidence column')
await expectError(`select reviewed_by from public.job_location_candidates`, 'public cannot read reviewer')

// 공고를 숨기거나 비활성화하면 승인 좌표도 공개 조회에서 빠진다
await db.exec(`reset role; update public.local_jobs set admin_hidden = true where id = 4453;`)
await db.exec(ANON)
ok((await q(`select job_id from public.job_location_candidates`)).length === 0, 'hidden job: approved coordinate not publicly readable')
await db.exec(`reset role; update public.local_jobs set admin_hidden = false, active = false where id = 4453;`)
await db.exec(ANON)
ok((await q(`select job_id from public.job_location_candidates`)).length === 0, 'inactive job: approved coordinate not publicly readable')
await db.exec(`reset role; update public.local_jobs set active = true where id = 4453;`)

// 재수집(근무지 행 전부 삭제 후 재삽입) → 승인 유지
await db.exec(`reset role;`)
await db.exec(`delete from public.job_work_locations where job_id = 4453; insert into public.job_work_locations(job_id, raw_address) values (4453, '${addr}');`)
ok((await q(`select status, work_location_id from public.job_location_candidates where id = ${als}`))[0].status === 'approved', 'recrawl (work location rows replaced) keeps the approval')

// 관리자 목록: 주소가 현재 공고에 있는지 표시
await db.exec(ADMIN)
let list = await q(`select id, status, address_still_present from public.admin_list_location_candidates() where id = ${als}`)
ok(list[0].address_still_present === true, 'admin list: address still present in current job')
await db.exec(`reset role; update public.job_work_locations set raw_address = 'Lô B2, KCN Quế Võ' where job_id = 4453;`)
await db.exec(ADMIN)
list = await q(`select address_still_present from public.admin_list_location_candidates() where id = ${als}`)
ok(list[0].address_still_present === false, 'admin list: flags when the job address changed (needs re-review)')
await db.exec(`reset role; update public.job_work_locations set raw_address = '${addr}' where job_id = 4453;`)

// 철회 → 공개 0건, 재승인 가능
await db.exec(ADMIN)
await q(`select public.admin_review_location_candidate(${als}, 'revoke', '테스트 철회')`)
await db.exec(ANON)
ok((await q(`select job_id from public.job_location_candidates`)).length === 0, 'after revoke: public sees nothing')
await db.exec(ADMIN)
await q(`select public.admin_review_location_candidate(${als}, 'approve', '재승인')`)
// 같은 주소 두 번째 후보 승인 → 이전 승인은 자동 철회(승인 1개 유지)
const als2 = (await q(`select (public.admin_add_location_candidate(4453, '${addr}', 21.07378, 105.98062, 'entrance', 'site_visit', '현장 출입구 확인')).id`))[0].id
await q(`select public.admin_review_location_candidate(${als2}, 'approve', '')`)
await db.exec(`reset role;`)
const st = await q(`select id, status from public.job_location_candidates where job_id = 4453 order by id`)
ok(st.filter((r) => r.status === 'approved').length === 1 && st.find((r) => r.id == als2).status === 'approved', 'only one approved location per job+address (older one superseded)')
const logs = await q(`select action from public.admin_audit_logs order by id`)
ok(logs.length >= 6 && logs.some((l) => l.action === 'location_candidate.revoke'), `audit log recorded (${logs.length} entries)`)

console.log(`\n결과: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

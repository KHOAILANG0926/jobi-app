// 20261107070000_job_duplicate_check.sql 사전 점검(PGlite, 운영 DB 접속 없음). Lee 2026-11-07 중복 4단계.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_duplicate_check.pglite.test.mjs
// 필요한 칸만 재구성했다(실제 운영 확인은 job_duplicate_check_production_check.sql).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function public.is_admin() returns boolean language sql as $$ select false $$;
create table public.local_jobs (
  id bigint primary key, title text, company text, occupation_code text, recruitment_type text,
  active boolean not null default true, admin_hidden boolean not null default false,
  created_at timestamptz not null default now());
create table public.job_work_locations (
  id bigint generated always as identity primary key, job_id bigint not null references public.local_jobs(id),
  lat double precision, lng double precision, point_kind text not null default 'unresolved',
  point_authority text not null default 'unresolved', industrial_park text);
`)
for (const f of ['20261106230000_job_company_codes.sql', '20261107070000_job_duplicate_check.sql', '20261108000000_agency_workplace_dedup.sql'])
  await db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'))

const NEW = `'2026-11-08 10:00+07'`
async function job(id, { company = 'Haidilao', occ = '5131', active = true, created = NEW, pts = [], park = null } = {}) {
  await db.exec(`insert into public.local_jobs(id,title,company,occupation_code,active,created_at) values (${id},'t${id}','${company}',${occ === null ? 'null' : `'${occ}'`},${active},${created})`)
  for (const [lat, lng, kind] of pts) await db.exec(`insert into public.job_work_locations(job_id,lat,lng,point_kind,industrial_park) values (${id},${lat},${lng},'${kind}',${park ? `'${park}'` : 'null'})`)
  if (!pts.length && park) await db.exec(`insert into public.job_work_locations(job_id,point_kind,industrial_park) values (${id},'area','${park}')`)
}
const attach = (id, core, kind = 'nha_hang', cat = 'am_thuc_do_uong', phones = '{}') =>
  db.query(`select public.job_identity_attach(${id}, '${core}', '${kind}', '${cat}', '', 'n', '${phones}'::text[]) as c`)
const check = async (id) => (await db.query(`select public.job_duplicate_check(${id}) as r`)).rows[0].r
const state = async (id) => (await db.query(`select active, duplicate_status s, duplicate_of::text o from public.local_jobs where id=${id}`)).rows[0]

// 기존(공개) 공고
await job(1, { pts: [[21.18, 106.07, 'exact']] }); await attach(1, 'haidilao')
// ① 확실한 중복: 같은 회사·같은 세부 일·150m 안 정확한 점 → 버림(비공개)
await job(2, { pts: [[21.1805, 106.0705, 'exact']] }); await attach(2, 'haidilao')
assert.match(await check(2), /^duplicate:1:/); assert.deepEqual(await state(2), { active: false, s: 'duplicate', o: '1' })
// ② 다른 지점(1km 밖) → 그대로 공개
await job(3, { pts: [[21.19, 106.07, 'exact']] }); await attach(3, 'haidilao')
assert.equal(await check(3), 'new'); assert.equal((await state(3)).active, true)
// ③ 다른 세부 일 → 공개
await job(4, { occ: '5120', pts: [[21.18, 106.07, 'exact']] }); await attach(4, 'haidilao')
assert.equal(await check(4), 'new')
// ④ 업무 미기재(큰 분류뿐) → 애매 → 비공개 + 게시판
await job(5, { occ: '5', pts: [[21.18, 106.07, 'exact']] }); await attach(5, 'haidilao')
assert.match(await check(5), /^suspect:\d+:job_unclear$/); assert.equal((await state(5)).active, false)
// ⑤ 위치가 대략뿐 → 애매
await job(6, { pts: [[21.18, 106.07, 'area']] }); await attach(6, 'haidilao')
assert.match(await check(6), /^suspect:\d+:location_unclear$/)
// ⑥ 다른 업종 같은 이름(카페 vs 식당) → 다른 회사 → 공개
await job(7, { pts: [[21.18, 106.07, 'exact']] }); await attach(7, 'haidilao', 'quan_ca_phe', 'am_thuc_do_uong')
assert.equal(await check(7), 'new')
// ⑦ 같은 공단 이름 = 같은 위치
await job(8, { company: 'Hojeong', occ: '8202', park: 'KCN Quế Võ', pts: [[21.15, 106.15, 'gate']] }); await attach(8, 'hojeong', 'san_xuat_xay_dung', 'san_xuat_xay_dung')
await job(9, { company: 'Hojeong', occ: '8202', park: 'kcn quế võ' }); await attach(9, 'hojeong', 'san_xuat_xay_dung', 'san_xuat_xay_dung')
assert.match(await check(9), /^duplicate:8:/)
// ⑧ 이름 없는 공고는 번호로 같은 회사
await job(10, { company: 'Quán Phở X', occ: '5131', pts: [[21.0, 105.9, 'exact']] }); await attach(10, 'phox', 'quan_an_binh_dan', 'am_thuc_do_uong', '{0912345678}')
await job(11, { company: '', occ: '5131', pts: [[21.0, 105.9001, 'exact']] }); await attach(11, 'p0912345678', null, null, '{0912345678}')
assert.match(await check(11), /^duplicate:10:/)
// ⑨ 기존 공고(규칙 전 등록)는 건드리지 않음
await job(12, { created: `'2026-11-01 10:00+07'`, pts: [[21.18, 106.07, 'exact']] }); await attach(12, 'haidilao')
assert.equal(await check(12), 'before_rule'); assert.equal((await state(12)).active, true)
// ⑩ 의심·중복 공고는 다른 작업이 공개로 바꿔도 비공개 유지
await db.exec(`update public.local_jobs set active = true where id in (2, 5)`)
assert.equal((await state(2)).active, false); assert.equal((await state(5)).active, false)
// ⑪ 보류였다가 공개되는 순간에도 판정
await job(13, { active: false, pts: [[21.18, 106.07, 'exact']] }); await attach(13, 'haidilao')
await db.exec(`update public.local_jobs set active = true where id = 13`)
assert.deepEqual(await state(13), { active: false, s: 'duplicate', o: '1' })
// ⑫ 등록 때 판정 칸은 받지 않음
await db.exec(`insert into public.local_jobs(id,title,company,duplicate_status) values (14,'t','x','cleared')`)
assert.equal((await state(14)).s, null)
// ⑬ 관리자 결정(서버 권한): 중복 아님 → 공개, 중복 → 비공개
assert.equal((await db.query(`select public.job_duplicate_decide(5, 'not_duplicate') r`)).rows[0].r, 'cleared')
assert.deepEqual(await state(5), { active: true, s: 'cleared', o: '1' })
assert.equal((await db.query(`select public.job_duplicate_decide(6, 'duplicate') r`)).rows[0].r, 'duplicate')
assert.equal((await state(6)).active, false)
await assert.rejects(db.query(`select public.job_duplicate_decide(1, 'duplicate')`), /중복 의심 공고가 아님/)
// ⑭ 업종: 큰 분류로 등록된 회사는 소분류 공고와 같은 회사, 업종을 소분류로 구체화
await job(20, { company: 'Trung Nguyên', pts: [[20.0, 105.0, 'exact']] }); const a = (await db.query(`select public.job_identity_attach(20,'trungnguyen','am_thuc_do_uong','am_thuc_do_uong','','n','{}') c`)).rows[0].c
await job(21, { company: 'Trung Nguyên Café', pts: [[20.5, 105.0, 'exact']] }); const b = (await db.query(`select public.job_identity_attach(21,'trungnguyen','quan_ca_phe','am_thuc_do_uong','','n','{}') c`)).rows[0].c
assert.equal(a, b); assert.equal((await db.query(`select kind from public.job_companies where id=${a}`)).rows[0].kind, 'quan_ca_phe')
// ⑮ 소개소 공고끼리(Lee 2026-11-07 A): 소개소·사무실이 같아도 실제 근무 공장이 다르면 다른 공고, 공장을 모르면 애매
const agency = async (id, plant) => {
  await job(id, { company: 'Nhân lực Minh Anh', occ: '8212', pts: [[21.3, 106.3, 'exact']] })
  await db.exec(`update public.local_jobs set recruitment_type = 'agency', agency_workplace_key = ${plant ? `'${plant}'` : 'null'} where id = ${id}`)
  await attach(id, 'nhanlucminhanh', null, null)
}
await agency(30, 'samsung')
await agency(31, 'canon'); assert.equal(await check(31), 'new')
await agency(32, 'samsung'); assert.match(await check(32), /^duplicate:30:/)
await agency(33, null); assert.match(await check(33), /^suspect:30:location_unclear$/)
assert.equal((await db.query(`select has_column_privilege('anon', 'public.local_jobs', 'agency_workplace_key', 'select') p`)).rows[0].p, false)
// 공개 접근 차단
assert.equal((await db.query(`select has_function_privilege('anon', 'public.job_duplicate_check(bigint)', 'execute') p`)).rows[0].p, false)
assert.equal((await db.query(`select has_function_privilege('anon', 'public.job_identity_attach(bigint,text,text,text,text,text,text[])', 'execute') p`)).rows[0].p, false)
console.log('job_duplicate_check: 확실한 중복 버림·애매 게시판·다른 지점/일/업종 공개·기존 공고 제외·공개 순간 판정·관리자 결정 통과')

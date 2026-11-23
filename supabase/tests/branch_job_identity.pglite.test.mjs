// 20261124000000_branch_job_identity.sql 사전 점검(PGlite, 운영 DB 접속 없음). Lee 2026-11-23 「지점별 독립 공고」, 이슈 #988.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/branch_job_identity.pglite.test.mjs
// 진짜 운영 함수 본문(ingest_job·find_existing(6)·dedupe_private.verdict)을 migration 파일에서 그대로 읽어 만든 뒤 새 migration을 적용한다 —
// 줄 바꾸기가 실제 본문에 맞는지(둘이면 RAISE)와 같은 글 지점 A·B·C가 서로 같은 공고·중복이 아닌지를 시험한다.
// ingest_job 전체(원문 보존·직업분류·공개 게이트)는 이 시험 대상이 아니다 — 입구 안에서 identity 두 줄만 바꾸므로 그 줄과 find_existing·verdict 의미를 본다.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const mig = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function public.is_admin() returns boolean language sql as $$ select false $$;
create schema ingest_private;
create function public.unaccent(x text) returns text language sql immutable as $$ select translate(lower(x),
 'àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ','aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd') $$;
create function public.job_phone_digits(x text) returns text language sql immutable as $$ select nullif(regexp_replace(coalesce(x,''), '[^0-9]', '', 'g'), '') $$;
create table public.local_jobs (
  id bigint primary key, title text, company text, occupation_code text, recruitment_type text,
  source_url text, source_text text, employer_phone text,
  active boolean not null default true, admin_hidden boolean not null default false,
  created_at timestamptz not null default now());
create table public.job_work_locations (
  id bigint generated always as identity primary key, job_id bigint not null references public.local_jobs(id),
  raw_address text, normalized_address text,
  lat double precision, lng double precision, point_kind text not null default 'unresolved',
  point_authority text not null default 'unresolved', industrial_park text);
create table public.job_ingest_raw (
  id bigint generated always as identity primary key, source_url text, content_hash text not null,
  job_id bigint references public.local_jobs(id));
`)
// 운영 admin_location_key 정의 그대로(20261025174000)
const keyDef = mig('20261025174000_admin_confirmed_location_memory.sql').match(/create or replace function public\.admin_location_key[\s\S]*?\$\$;/)[0]
await db.exec(keyDef)
for (const f of ['20261106230000_job_company_codes.sql', '20261107070000_job_duplicate_check.sql', '20261108000000_agency_workplace_dedup.sql']) await db.exec(mig(f))
// 운영 find_existing(6)·ingest_job 본문을 파일에서 그대로
const oneDoor = mig('20261029010000_ingest_one_door.sql')
await db.exec(oneDoor.match(/create function ingest_private\.find_existing[\s\S]*?\n\$\$;/)[0])
await db.exec(oneDoor.match(/create or replace function public\.ingest_job\(p jsonb\)[\s\S]*?\nend \$\$;/)[0])
assert.ok((await db.query(`select to_regprocedure('ingest_private.find_existing(bigint,text,text,text,text,text)') is not null as ok`)).rows[0].ok, 'fixture: 운영 find_existing(6) 로드')

// ── 새 migration 적용: 줄 바꾸기가 운영 본문에 그대로 맞아야 한다(안 맞으면 RAISE로 여기서 멈춘다) ──
await db.exec(mig('20261124000000_branch_job_identity.sql'))
const def = (await db.query(`select pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure) d`)).rows[0].d
assert.ok(def.includes(`ingest_private.branch_key(p->>'branch_location')`), 'ingest_job 해시에 지점 위치가 들어감')
assert.ok(def.includes(`p->>'source_text', p->>'branch_location')`), 'ingest_job이 지점 위치를 find_existing에 넘김')
assert.equal((await db.query(`select to_regprocedure('ingest_private.find_existing(bigint,text,text,text,text,text)') is null as gone`)).rows[0].gone, true, '6개 자리 find_existing은 지워짐')
const vdef = (await db.query(`select pg_get_functiondef('dedupe_private.verdict(bigint)'::regprocedure) d`)).rows[0].d
assert.ok(vdef.includes('j.source_url = (select s.source_url from public.local_jobs s where s.id = p_job)'), '중복 판정이 같은 원문 글 형제를 건너뜀')
await assert.rejects(db.exec(mig('20261124000000_branch_job_identity.sql')), /find_existing\(6\) 없음|already exists/, '두 번 적용은 막힘')

// ── 같은 공고 판정: 지점 위치 식별자 ──
const A = 'Lô A1, KCN Quế Võ, Bắc Ninh', B = 'Lô D4, KCN Quế Võ, Bắc Ninh', C = 'Lô E7, KCN Quế Võ, Bắc Ninh'
const URL1 = 'https://facebook.com/posts/1', TEXT = 'Tuyển công nhân 2 lô\nLô A1 ... Lô D4', PHONE = '0912 345 678', COMPANY = 'CTY Hojeong'
const hashOf = (branch) => `h:${branch ?? 'plain'}`
async function postJob(id, address, { url = URL1, text = TEXT, company = COMPANY, phone = PHONE, occ = '8202', created = `'2026-11-24 10:00+07'` } = {}) {
  await db.query(`insert into public.local_jobs(id,title,company,occupation_code,source_url,source_text,employer_phone,created_at) values ($1,'t',$2,$3,$4,$5,$6,${created})`, [id, company, occ, url, text, phone])
  await db.query(`insert into public.job_work_locations(job_id,raw_address,normalized_address) values ($1,$2,public.admin_location_key($2))`, [id, address])
  await db.query(`insert into public.job_ingest_raw(source_url,content_hash,job_id) values ($1,$2,$3)`, [url, hashOf(address), id])
}
await postJob(1, A); await postJob(2, B)
const find = async (rawId, hash, branch) => (await db.query(`select ingest_private.find_existing($1,$2,$3,$4,$5,$6,$7) as id`, [rawId, hash, URL1, PHONE, COMPANY, TEXT, branch])).rows[0].id
// 지점 위치가 없으면 예전과 같다(같은 글이면 첫 공고)
assert.equal(Number(await find(999, 'other', null)), 1, '지점 위치 없음 = 예전 동작(같은 글 → 첫 공고)')
// 같은 글의 지점별로 각자 자기 공고(문장부호·대소문자 달라도 같은 위치 식별자)
assert.equal(Number(await find(999, hashOf(A), 'lô a1 kcn quế võ bắc ninh')), 1, '지점 A는 공고 1')
assert.equal(Number(await find(999, 'other', B)), 2, '지점 B는 공고 2 — 같은 글이라도 A 공고로 합쳐지지 않음')
assert.equal(await find(999, hashOf(C), C), null, '새 지점 C는 기존 공고가 없음 → 새 공고로 등록')
assert.equal(await find(999, 'other', C), null, '새 지점 C: 같은 글의 raw 기록(source_url 일치)이 있어도 지점이 다르면 다른 공고')
// 다른 글의 같은 지점 주소는 같은 공고가 아니다(원본 식별자도 같아야 한다)
assert.equal((await db.query(`select ingest_private.find_existing(999,'x','https://facebook.com/posts/OTHER',$1,$2,'다른 글',$3) as id`, [PHONE, COMPANY, A])).rows[0].id, null, '다른 글·같은 주소 = 다른 공고')
// 원문+연락처+회사 같은 길(source_url 없음)도 지점별로 갈린다
assert.equal(Number((await db.query(`select ingest_private.find_existing(999,'x',null,$1,$2,$3,$4) as id`, [PHONE, COMPANY, TEXT, B])).rows[0].id), 2, 'source_url 없는 길도 지점별')
assert.equal((await db.query(`select ingest_private.find_existing(999,'x',null,$1,$2,$3,$4) as id`, [PHONE, COMPANY, TEXT, C])).rows[0].id, null, 'source_url 없는 길: 새 지점은 새 공고')

// ── 형제 지점 공고는 서로 중복이 아니다(같은 회사·같은 일·같은 공단이라도) ──
const attach = (id) => db.query(`select public.job_identity_attach(${id}, 'hojeong', 'san_xuat_xay_dung', 'san_xuat_xay_dung', '', 'n', '{}'::text[])`)
await db.query(`update public.job_work_locations set industrial_park = 'KCN Quế Võ'`)
for (const id of [1, 2]) await attach(id)
const check = async (id) => (await db.query(`select public.job_duplicate_check(${id}) as r`)).rows[0].r
const st = async (id) => (await db.query(`select active, duplicate_status s from public.local_jobs where id=${id}`)).rows[0]
assert.equal(await check(2), 'new', '같은 글의 형제 지점 공고(2)는 중복이 아님')
assert.deepEqual(await st(2), { active: true, s: null }, '형제 지점 공고는 꺼지지 않음')
// 다른 글(source_url이 다름)의 같은 회사·같은 일·같은 공단은 기존대로 중복
await postJob(3, A, { url: 'https://facebook.com/posts/OTHER' }); await db.query(`update public.job_work_locations set industrial_park = 'KCN Quế Võ' where job_id = 3`); await attach(3)
assert.match(await check(3), /^duplicate:1:/, '다른 글의 같은 지점 공고는 기존대로 중복 판정')
// source_url이 없는 공고끼리는 면제하지 않는다(기존 동작)
await postJob(4, B, { url: null, text: 'no url a' }); await db.query(`update public.job_work_locations set industrial_park = 'KCN Quế Võ' where job_id = 4`); await attach(4)
await postJob(5, A, { url: null, text: 'no url b' }); await db.query(`update public.job_work_locations set industrial_park = 'KCN Quế Võ' where job_id = 5`); await attach(5)
assert.match(await check(5), /^duplicate:/, 'source_url이 없으면 형제 면제 없음(기존 동작)')
console.log('branch_job_identity: migration patch applies to real function text; per-branch identity and sibling dedupe passed')
await db.close()

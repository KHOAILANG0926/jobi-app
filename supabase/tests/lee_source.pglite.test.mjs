// Local-only R3 behavior, no operational database access.
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const db = new PGlite({ extensions: { unaccent } })
await db.exec(`create extension unaccent;
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
create function public.is_admin() returns boolean language sql as $$select false$$;
create table public.local_jobs(id bigint generated always as identity primary key, title text not null,
company text not null, source text, category text default 'other', salary text, employer_phone text,
description text, active boolean default false, origin text default 'legacy', admin_hidden boolean default true,
source_url text, images jsonb, contact_zalo text, policy_decision text);
grant all on public.local_jobs to service_role;
grant usage, select on all sequences in schema public to service_role;`)
await db.exec(read('../migrations/20261012153000_job_posting_policy_db_enforcement.sql'))
await db.exec(read('../migrations/20261013100000_job_posting_rules.sql'))
if (process.env.APPLY_LEE_RULES !== '0') await db.exec(read('../migrations/20261028034009_lee_verified_sources.sql'))
const source = 'Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김'
const insert = (s = source, text = 'Bomunttl\nCÔ RỬA BÁT\nNHÂN VIÊN NAM/NỮ CHẠY BÀN', origin = 'admin') => db.query(
`insert into local_jobs(title,company,origin,source,source_text,active) values('Bomunttl','Bomunttl',$1,$2,$3,false) returning id`, [origin,s,text])
const row = await insert()
assert.equal(row.rows.length, 1, 'Lee attestation accepted without URL or image')
await assert.rejects(insert(source, ''), /job_rule_R3/, 'original text remains required')
await assert.rejects(insert('Lee 확인'), /job_rule_R3/, 'incomplete attestation rejected')
await assert.rejects(insert(source, 'Bomunttl', 'crawler'), /job_rule_R3/, 'crawler cannot claim human attestation')
await db.exec('set role service_role')
await assert.rejects(insert(), /job_rule_R3/, 'service_role cannot mint attestation')
for (const origin of ['legacy','crawler']) {
 await assert.rejects(db.query(`insert into local_jobs(title,company,origin,source,source_text,source_url) values('forged','Bomunttl',$1,$2,'Bomunttl','test://ordinary-source')`,[origin,source]), /job_rule_R3/, 'reserved confirmation cannot be forged through another origin')
}
await db.exec('reset role')
await db.exec(`grant usage on schema public to service_role`)
// Original text cannot be changed while reusing human confirmation.
await db.exec('set role service_role')
await assert.rejects(db.query('update local_jobs set source_text=$1 where id=$2', ['Bomunttl changed',row.rows[0].id]), /job_rule_R3/)
await db.exec('reset role')
// Ordinary updates preserve owner-recorded evidence; removing sole evidence fails.
await db.exec('set role service_role')
await db.query('update local_jobs set salary=$1 where id=$2', ['Theo vị trí — xem chi tiết',row.rows[0].id])
await assert.rejects(db.query('update local_jobs set source=null where id=$1',[row.rows[0].id]), /job_rule_R3/)
await db.exec('reset role')
await db.exec(read('./job_posting_rules_test.sql'))
assert.equal((await db.query("select last_test_result from job_posting_rules where rule_key='R3_source_evidence_required'")).rows[0].last_test_result, '통과')
// Exercise the actual registration SQL with actual occupation rules. The location
// adapter below validates the writer contract only; canonical coordinate behavior
// belongs to the existing PostgreSQL location integration suite.
for (const f of ['20261015100000_occupation_master.sql', '20261015100100_occupation_master_seed.sql',
  '20261015120000_local_jobs_occupation_r8.sql', '20261017070517_occupation_publication_gate.sql',
  '20261018090000_occupation_code_any_level.sql']) await db.exec(read(`../migrations/${f}`))
await db.exec(`alter table public.local_jobs add column location text, add column hours text, add column posted_at date default current_date,
 add column meal_provided boolean, add column salary_min numeric, add column salary_max numeric,
 add column salary_currency text, add column salary_period text;
create schema location_private;
create table public.job_work_locations(job_id bigint,raw_address text,lat float8,lng float8,point_kind text);
create function location_private.write_location(p_id bigint,p_op text,p jsonb) returns bigint language plpgsql as $$
begin
 if p_op <> 'upsert' or p->>'authority' <> 'unresolved' or p ? 'lat' or p ? 'lng' then
  raise exception 'invalid location writer contract';
 end if;
 insert into public.job_work_locations values(p_id,p->>'raw_address',null,null,'unresolved');
 return p_id;
end $$;`)
const registration = read('../migrations/20261028034036_register_bomunttl.sql')
await db.exec(registration)
await db.exec(registration)
await db.exec(read('./bomunttl_production_check.sql'))
assert.equal((await db.query("select count(*)::int n from local_jobs where employer_phone='0365447485'")).rows[0].n,1)
const registered = (await db.query("select * from local_jobs where employer_phone='0365447485'")).rows[0]
assert.equal(registered.occupation_code,'9402')
assert.equal(registered.active,true)
assert(registered.source_text.includes('(tg: 10h - 10h)'))
assert.equal(registered.salary_min,null)
await db.query("update local_jobs set salary='conflict' where id=$1",[registered.id])
// The production check must name every differing column with operational and expected values.
await assert.rejects(db.exec(read('./bomunttl_production_check.sql')),/differ — salary: 운영값="conflict" 기대값="Theo vị trí — xem chi tiết"$/)
await assert.rejects(db.exec(registration),/Bomunttl conflict/)
await db.exec('rollback')
console.log('PASS: Lee source accepted; absent text, incomplete/crawler/forged attestations and evidence removal rejected; original rules retained')
await db.close()

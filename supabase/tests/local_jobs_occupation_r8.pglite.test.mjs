// 20261015120000_local_jobs_occupation_r8.sql 사전 점검(PGlite, 로컬 흉내 DB — 운영 DB 접속 없음).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/local_jobs_occupation_r8.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create table public.local_jobs (id bigint primary key, title text not null, company text not null, description text, source_text text,
  source_url text, active boolean default true, admin_hidden boolean not null default false, category text default 'khac');
alter table public.local_jobs enable row level security;
create policy pub_read on public.local_jobs for select to anon, authenticated using (active and not admin_hidden);
grant select (id, title, company, description, active, admin_hidden, category) on public.local_jobs to anon, authenticated;
insert into public.local_jobs (id, title, company, source_text, category) values
 (4824, 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', 'CTY KDA', 'KCN YÊN PHONG\nCTY KDA\nLàm ngồi linh kiện tai nghe', 'san_xuat_xay_dung');`)
await db.exec(read('../migrations/20261015100000_occupation_master.sql'))
await db.exec(read('../migrations/20261015100100_occupation_master_seed.sql'))
const mig = read('../pending/20261015120000_local_jobs_occupation_r8.sql')
await db.exec(mig); await db.exec(mig) // 멱등

const one = async (sql) => (await db.query(sql)).rows[0]
const rejects = (sql, m) => assert.rejects(db.exec(sql), /job_rule_R8|foreign key/, m)

// 기존 공고: 미분류로 시작, 공개 상태·다른 칸 그대로
assert.deepEqual(await one('select occupation_code, occupation_evidence, active, admin_hidden, category from public.local_jobs where id = 4824'),
  { occupation_code: null, occupation_evidence: null, active: true, admin_hidden: false, category: 'san_xuat_xay_dung' })

// 정상: 원문 근거 있는 공식 코드
await db.exec(`update public.local_jobs set occupation_code = '82022', occupation_evidence = 'làm linh kiện tai nghe' where id = 4824`)
assert.equal((await one('select occupation_code from public.local_jobs where id = 4824')).occupation_code, '82022')
// 대소문자 차이는 같은 글자로 본다
await db.exec(`update public.local_jobs set occupation_evidence = 'LÀM LINH KIỆN TAI NGHE' where id = 4824`)

// 거부: 없는 코드 / 1~3단계 / 근거 없음 / 원문에 없는 근거 / 코드 없이 근거만
await rejects(`update public.local_jobs set occupation_code = '99999', occupation_evidence = 'làm linh kiện tai nghe' where id = 4824`, '없는 코드')
await rejects(`update public.local_jobs set occupation_code = '82', occupation_evidence = 'làm linh kiện tai nghe' where id = 4824`, '2단계 코드')
await rejects(`update public.local_jobs set occupation_code = '7212', occupation_evidence = null where id = 4824`, '근거 없음')
await rejects(`update public.local_jobs set occupation_code = '7212', occupation_evidence = 'thợ hàn' where id = 4824`, '원문에 없는 근거')
await rejects(`update public.local_jobs set occupation_code = null, occupation_evidence = 'thợ hàn' where id = 4824`, '근거만')
await rejects(`insert into public.local_jobs (id, title, company, occupation_code, occupation_evidence) values (1, 'Tuyển gấp', 'X', '7212', 'thợ hàn')`, '새 공고 근거 없음')
await db.exec(`insert into public.local_jobs (id, title, company, occupation_code, occupation_evidence) values (2, 'Tuyển thợ hàn TIG', 'X', '7212', 'thợ hàn')`)

// 제목 수정으로 근거가 사라지면: 수정은 되고 미분류로 돌아감(공개 상태 그대로)
await db.exec(`update public.local_jobs set title = 'Tuyển gấp nhiều vị trí' where id = 2`)
assert.deepEqual(await one('select title, occupation_code, occupation_evidence, active from public.local_jobs where id = 2'),
  { title: 'Tuyển gấp nhiều vị trí', occupation_code: null, occupation_evidence: null, active: true })

// 공개 읽기: 두 칸 읽힘, source_text는 여전히 막힘
await db.exec('set role anon')
assert.equal((await db.query('select occupation_code, occupation_evidence from public.local_jobs where id = 4824')).rows[0].occupation_code, '82022')
await assert.rejects(db.query('select source_text from public.local_jobs'), /permission denied/)
await db.exec('reset role')

// 롤백
await db.exec(read('../pending/20261015120000_local_jobs_occupation_r8_rollback.sql'))
assert.equal(Number((await one(`select count(*) n from information_schema.columns where table_name = 'local_jobs' and column_name like 'occupation_%'`)).n), 0)
assert.equal((await one('select title from public.local_jobs where id = 4824')).title.startsWith('CTY KDA'), true)
console.log('local_jobs_occupation_r8 pglite: OK')

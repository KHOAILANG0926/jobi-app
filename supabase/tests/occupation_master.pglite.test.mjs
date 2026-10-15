// 20261015100000_occupation_master.sql + _seed.sql 사전 점검(PGlite, 로컬 흉내 DB — 운영 DB 접속 없음).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/occupation_master.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const codes = JSON.parse(read('../../data/occupations/34-2020/occupation_codes.json'))
const descriptions = JSON.parse(read('../../data/occupations/34-2020/descriptions.json'))
const ddl = read('../pending/20261015100000_occupation_master.sql')
const seed = read('../pending/20261015100100_occupation_master_seed.sql')
const rollback = read('../pending/20261015100000_occupation_master_rollback.sql')

const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;`)
const as = async (role, sql) => { await db.exec(`set role ${role}`); try { return await db.query(sql) } finally { await db.exec('reset role') } }
const one = async (sql) => (await db.query(sql)).rows[0]

// 두 번 실행해도 같은 결과(멱등)
for (let i = 0; i < 2; i++) { await db.exec(ddl); await db.exec(seed) }

// 건수: JSON 추출 결과와 DB 일치
assert.equal(Number((await one('select count(*) n from public.occupation_master')).n), codes.length, 'master 건수')
assert.equal(Number((await one('select count(*) n from public.occupation_descriptions')).n), descriptions.length, '설명 건수')
const perLevel = (await db.query('select level, count(*)::int n from public.occupation_master group by level order by level')).rows
assert.deepEqual(perLevel.map((r) => r.n), [10, 48, 152, 509, 786], '단계별 건수')

// 무결성: 부모 없음 0, 앞자리 0 보존
assert.equal(Number((await one(`select count(*) n from public.occupation_master c left join public.occupation_master p on p.code = c.parent_code
  where c.level > 1 and p.code is null`)).n), 0, '부모 누락')
assert.ok(await one(`select 1 from public.occupation_master where code = '01' and parent_code = '0'`), '앞자리 0 코드 보존')
assert.ok(await one(`select 1 from public.occupation_master where code = '13300' and parent_code = '1330'`), '원본 오타 보정 코드')
assert.ok(await one(`select 1 from public.occupation_aliases where code = '3514' and alias_vi = 'Kỹ thuật viên trang web'`), '동의어')

// 원본에 없는 코드·잘못된 계층은 저장 거부
const rejects = async (sql, m) => { await assert.rejects(db.exec(sql), undefined, m) }
await rejects(`insert into public.occupation_master values ('99999', 5, '9999', 'x', 'f', 1)`, '없는 부모')
await rejects(`insert into public.occupation_master values ('7212', 3, '721', 'x', 'f', 1)`, '길이≠단계')
await rejects(`insert into public.occupation_master values ('72', 2, '8', 'x', 'f', 1)`, '부모 접두어 불일치')
await rejects(`insert into public.occupation_aliases (code, alias_vi, source) values ('zzz', 'x', 'appendix_ii_title')`, '없는 코드 동의어')

// 공개 읽기만 허용, 쓰기 차단
for (const role of ['anon', 'authenticated']) {
  assert.equal((await as(role, `select code from public.occupation_master where code = '7212'`)).rows.length, 1, `${role} 읽기`)
  await assert.rejects(as(role, `insert into public.occupation_master values ('8', 1, null, 'x', 'f', 1)`), /permission denied|row-level security/, `${role} 쓰기 차단`)
  await assert.rejects(as(role, `update public.occupation_master set name_vi = 'x' where code = '7212'`), /permission denied|row-level security/, `${role} 수정 차단`)
}

// 롤백 후 테이블 없음
await db.exec(rollback)
assert.equal(Number((await one(`select count(*) n from information_schema.tables where table_name like 'occupation_%'`)).n), 0, '롤백')
console.log('occupation_master pglite: OK', { master: codes.length, descriptions: descriptions.length })

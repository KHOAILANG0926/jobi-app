// 20261025140000_detail_line_kinds.sql 사전 점검(PGlite, 운영 DB 접속 없음).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`)
const mig = readFileSync(new URL('../migrations/20261025140000_detail_line_kinds.sql', import.meta.url), 'utf8')
await db.exec(mig); await db.exec(mig)
await db.exec(`insert into public.detail_line_kinds values ('co xe dua don', '05', 'Có xe đưa đón', 'lee', now())`)
await db.exec(`update public.detail_line_kinds set section = '07', decided_by = 'ai' where line_key = 'co xe dua don'`)
assert.deepEqual((await db.query(`select section, decided_by from public.detail_line_kinds`)).rows[0], { section: '05', decided_by: 'lee' }, 'AI는 Lee가 정한 칸을 못 바꿈')
await assert.rejects(db.exec(`insert into public.detail_line_kinds values ('x', '99', 'x', 'ai', now())`), /check/i, '목록 밖 칸 거부')
assert.equal((await db.query(`select has_table_privilege('anon', 'public.detail_line_kinds', 'select') p`)).rows[0].p, false)
console.log('detail_line_kinds: Lee 우선·칸 목록·공개 접근 차단 검사 통과')

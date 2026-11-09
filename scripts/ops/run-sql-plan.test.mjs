// ops-run-sql.yml 허용 문장 시험(Lee 2026-11-09 "좁히기"). DB가 읽기 전용으로 쓰기를 거부하는 것은 로컬 PostgreSQL로 확인(PR 설명).
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { planSql } from './run-sql-plan.mjs'

const fix = (o) => `select public.ingest_job($ingest$${JSON.stringify(o)}$ingest$::jsonb) as job_id \\gset`
const ok = fix({ title: 't', salary: '1', job_id: 5422, update_fields: ['salary'] })

// 기존 정상 공고 고치기 경로 유지: 11/4·11/6에 실제로 돌린 fix-* 파일은 모두 통과해야 한다
const dir = new URL('./jobs/', import.meta.url)
const fixes = readdirSync(dir).filter((f) => /^fix-.*\.sql$/.test(f))
assert.ok(fixes.length >= 9, 'existing fix files found')
for (const f of fixes) assert.equal(planSql(readFileSync(new URL(f, dir), 'utf8')).ok, true, `existing fix file ${f} still allowed`)
for (const f of ['count-location-deletions.sql', 'list-location-hidden-jobs.sql']) assert.equal(planSql(readFileSync(new URL(f, dir), 'utf8')).ok, true, `read-only report ${f} allowed`)

// 읽기 전용은 입구 호출 바로 뒤에 걸린다(없으면 처음부터)
const p = planSql(`-- 설명\n${ok}\nselect id from public.local_jobs where id = :job_id;\n`)
assert.equal(p.ok, true)
assert.deepEqual(p.sql.trim().split('\n').map((l) => l.slice(0, 26)), ['\\set ON_ERROR_STOP 1', 'begin;', ok.slice(0, 26), 'set transaction read only;', 'select id from public.loca', 'commit;'])
assert.match(planSql('select 1;\n').sql, /^\\set ON_ERROR_STOP 1\nbegin;\nset transaction read only;\nselect 1;\ncommit;\n$/)

const bad = (text, why) => assert.equal(planSql(text).ok, false, why)
bad('update public.local_jobs set active = true;', 'direct UPDATE rejected')
bad('delete from public.local_jobs;', 'DELETE rejected')
bad('insert into public.local_jobs(id) values (1);', 'INSERT rejected')
bad('drop table public.local_jobs;', 'DROP rejected')
bad('commit;\nupdate public.local_jobs set active = true;', 'transaction escape rejected')
bad('select 1; delete from public.local_jobs;', 'two statements on one line rejected')
bad('select 1;\nselect 2', 'unterminated statement rejected')
bad(`select 1;\n${ok}`, 'ingest call must be first')
bad(`${ok}\n${ok}`, 'only one ingest call')
bad(fix({ title: 'new job' }), 'new job (no job_id) must use ops-insert-job')
bad(fix({ job_id: 1 }), 'update_fields required')
bad(fix({ job_id: 1, update_fields: [] }), 'empty update_fields rejected')
bad('select public.ingest_job($ingest${"job_id":1,"update_fields":["a"]} $ingest$ $ingest$::jsonb) as job_id \\gset', 'dollar tag inside payload rejected')
bad(`${ok.replace(' \\gset', '')}; delete from public.local_jobs;`, 'extra statement after ingest call rejected')
bad('select 1;\n\\! rm -rf /', 'shell command rejected')
bad('select 1;\n\\i other.sql', 'include rejected')
bad('select 1 \\gexec', 'gexec rejected')
bad('select pg_terminate_backend(1);', 'admin function rejected (read-only does not block it)')
bad('select set_config(\'x\', \'y\', false);', 'set_config rejected')
bad('select lo_export(1, \'/tmp/x\');', 'server file function rejected')
bad('select "pg_cancel_backend"(123);', 'quoted admin function name rejected (Codex #590)')
bad('select pg_cancel_backend/**/(123);', 'comment between name and parenthesis rejected (Codex #590)')
bad('select pg_catalog.pg_cancel_backend (123);', 'schema-qualified admin function rejected')
bad('select 1 -- x\n, pg_cancel_backend(1);', 'inline comment rejected')
bad('select :evil;', 'psql variable other than :job_id rejected')
bad('select id from public.local_jobs where id = :job_id;', ':job_id only after ingest call')
bad('select $$x$$;', 'dollar quoting in queries rejected')
bad('', 'empty file rejected')
assert.equal(planSql("select '::notice::' || count(*) from public.local_jobs;").ok, true, 'colons inside quoted text are not psql variables')
console.log('run-sql-plan: all assertions passed')

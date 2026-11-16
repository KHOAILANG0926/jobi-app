import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('rule checks cannot replay historical migrations over newer source protections', () => {
 const workflow=readFileSync('.github/workflows/job-rules-apply.yml','utf8')
 assert(!/psql[^\n]+-f\s+supabase\/migrations\//.test(workflow), 'historical SQL replay would erase the updated R3 function')
 assert(workflow.includes('supabase_migrations.schema_migrations'), 'verify baseline was applied by normal migration path')
 // #858(2026-11-16): R1~R7·U2 규칙 시험은 운영 DB가 아니라 시험용 DB(PGlite)에서 돈다 — 운영에 시험 공고를 넣지 않고, 시험 자체는 계속 필수로 돈다.
 assert(!/psql[^\n]+-f\s+supabase\/tests\/job_posting_rules_test\.sql/.test(workflow), 'rules test must not insert test jobs into production')
 const ci=readFileSync('.github/workflows/occupation-publication-check.yml','utf8')
 assert(/^\s*node supabase\/tests\/job_posting_rules\.pglite\.test\.mjs/m.test(ci), 'retain the database rules test (test DB, every PR)')
 assert(readFileSync('supabase/tests/job_posting_rules.pglite.test.mjs','utf8').includes("job_posting_rules_test.sql"), 'test DB runs the same rules test SQL')
})

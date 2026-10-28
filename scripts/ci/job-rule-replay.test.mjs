import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('rule checks cannot replay historical migrations over newer source protections', () => {
 const workflow=readFileSync('.github/workflows/job-rules-apply.yml','utf8')
 assert(!/psql[^\n]+-f\s+supabase\/migrations\//.test(workflow), 'historical SQL replay would erase the updated R3 function')
 assert(workflow.includes('supabase_migrations.schema_migrations'), 'verify baseline was applied by normal migration path')
 assert(workflow.includes('supabase/tests/job_posting_rules_test.sql'), 'retain actual database rules test')
})

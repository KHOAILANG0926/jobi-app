// Optional, isolated in-memory PostgreSQL. Requires @electric-sql/pglite; no DB URL.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import cases from '../policy/cases.json' with { type: 'json' }
import spec from '../policy/job-posting-v1.json' with { type: 'json' }
import { evaluateJobPolicy } from '../policy/job-posting.mjs'
import { execFileSync } from 'node:child_process'
const sql = readFileSync(new URL('../supabase/pending/20261012090000_job_publication_policy.sql', import.meta.url), 'utf8')
assert.deepEqual(JSON.parse(sql.split('$spec$')[1]), spec, 'SQL rules snapshot must match shared spec')
const db = new PGlite() // memory only, no dataDir or network
await db.exec('CREATE TABLE local_jobs (id integer PRIMARY KEY, title text, description text, category text, active boolean, admin_hidden boolean);')
// Keep draft rollback intact on disk; only this disposable DB executes before rollback.
await db.exec(sql.replace(/ROLLBACK;\s*$/, 'COMMIT;'))
const python = process.env.POLICY_TEST_PYTHON || 'python'
const pythonResults = JSON.parse(execFileSync(python, ['-X', 'utf8', '-c',
  "import sys,json;sys.path.insert(0,'crawler');from job_posting_policy import evaluate_job_policy;print(json.dumps([evaluate_job_policy(c['job']) for c in json.load(sys.stdin)]))"],
  {input:JSON.stringify(cases),encoding:'utf8'}))
for (const c of cases) {
  const {rows} = await db.query('SELECT evaluate_job_policy_v1($1::jsonb) AS verdict', [JSON.stringify(c.job)])
  assert.equal(rows[0].verdict.decision, c.decision, c.name)
  assert.deepEqual(rows[0].verdict, evaluateJobPolicy(c.job), `${c.name}: SQL/JS full verdict`)
  assert.deepEqual(rows[0].verdict, pythonResults[cases.indexOf(c)], `${c.name}: SQL/Python full verdict`)
}
// Historical published content: insert before attaching the trigger to represent a pre-existing row.
await db.exec("ALTER TABLE local_jobs DISABLE TRIGGER job_publication_policy_v1; INSERT INTO local_jobs VALUES (9,'Sales','Chưa rõ nhiệm vụ','',true,false); ALTER TABLE local_jobs ENABLE TRIGGER job_publication_policy_v1;")
await db.exec('UPDATE local_jobs SET id=10 WHERE id=9;')
await db.exec('UPDATE local_jobs SET admin_hidden=true WHERE id=10;')
await assert.rejects(() => db.exec('UPDATE local_jobs SET admin_hidden=false WHERE id=10;'), /job_policy/)
await db.exec('DELETE FROM local_jobs WHERE id=10;')
await db.exec("INSERT INTO local_jobs VALUES (1,'QC','Kiểm tra chất lượng','',true,false);")
await assert.rejects(() => db.exec("UPDATE local_jobs SET title='Sales B2B' WHERE id=1;"), /job_policy/)
await db.exec("INSERT INTO local_jobs VALUES (2,'Sales B2B','B2B','',false,true);")
await assert.rejects(() => db.exec('UPDATE local_jobs SET active=true,admin_hidden=false WHERE id=2;'), /job_policy/)
await assert.rejects(() => db.exec("INSERT INTO local_jobs VALUES (3,'Tư vấn tín dụng','Cho vay','',true,false);"), /job_policy/)
await db.exec('DROP FUNCTION evaluate_job_policy_v1(jsonb);')
await assert.rejects(() => db.exec("INSERT INTO local_jobs VALUES (4,'QC','Kiểm tra chất lượng','',true,false);"))
assert.equal((await db.query('SELECT count(*)::int AS count FROM local_jobs')).rows[0].count, 2)
await db.close()
console.log(`SQL draft: ${cases.length} shared cases, insert/edit/reopen/failure atomic gates passed (memory only)`)

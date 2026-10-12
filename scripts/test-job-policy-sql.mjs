// Optional, isolated in-memory PostgreSQL. Requires @electric-sql/pglite; no DB URL.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import cases from '../policy/cases.json' with { type: 'json' }
import spec from '../policy/job-posting-v1.json' with { type: 'json' }
const sql = readFileSync(new URL('../supabase/pending/20261012090000_job_publication_policy.sql', import.meta.url), 'utf8')
assert.deepEqual(JSON.parse(sql.split('$spec$')[1]), spec, 'SQL rules snapshot must match shared spec')
const db = new PGlite() // memory only, no dataDir or network
await db.exec('CREATE TABLE local_jobs (id integer PRIMARY KEY, title text, description text, category text, active boolean, admin_hidden boolean);')
// Keep draft rollback intact on disk; only this disposable DB executes before rollback.
await db.exec(sql.replace(/ROLLBACK;\s*$/, 'COMMIT;'))
for (const c of cases) {
  const {rows} = await db.query('SELECT evaluate_job_policy_v1($1::jsonb) AS verdict', [JSON.stringify(c.job)])
  assert.equal(rows[0].verdict.decision, c.decision, c.name)
}
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

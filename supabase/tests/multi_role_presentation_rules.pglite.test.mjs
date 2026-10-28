import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
await db.exec(`create table job_posting_rules(rule_key text unique,content text,decided_on date,machine_checkable text,block_mode text,implementation text)`)
const migration=read('../migrations/20261028051147_multi_role_presentation_rules.sql')
await assert.rejects(db.exec(migration),/previous decisions missing/)
await db.exec('rollback')
await db.exec(`insert into job_posting_rules(rule_key,content)values('R10_multi_role_conditions','old'),('R12_location_precision_review','old')`)
await db.exec(migration)
await db.exec(migration)
await db.exec(read('./multi_role_presentation_production_check.sql'))
assert.equal((await db.query('select count(*)::int n from job_posting_rules')).rows[0].n,3)
console.log('PASS presentation rules: preflight, idempotence and production check')
await db.close()

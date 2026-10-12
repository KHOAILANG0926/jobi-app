// Guards drift between policy/job-posting-rules.json (JS/Python judges) and the
// rules embedded in the DB trigger migration (public.job_policy_rules()).
// If you change the JSON rules, add a new migration that updates job_policy_rules()
// and point MIGRATION below at it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import rules from '../policy/job-posting-rules.json' with { type: 'json' }

const MIGRATION = 'supabase/migrations/20261012153000_job_posting_policy_db_enforcement.sql'
const root = join(import.meta.dirname, '..')
const sql = readFileSync(join(root, MIGRATION), 'utf8')
const m = sql.match(/select '(\{.*\})'::jsonb/)
if (!m) throw new Error('job_policy_rules() JSON not found in ' + MIGRATION)
const db = JSON.parse(m[1].replace(/''/g, "'"))

const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const expected: Record<string, unknown> = {}
for (const [k, v] of Object.entries(rules as Record<string, unknown>)) {
  if (k === 'debt') continue
  expected[k] = k === 'version' ? v : (v as string[]).map(p => p.replaceAll('\\b', '\\y'))
}
const win: string[] = []
for (const [root_, targets, w] of (rules as any).debt as [string, string[], number][]) for (const t of targets) {
  const a = '\\y' + esc(root_) + '\\y', b = '\\y' + esc(t) + '\\y'
  win.push(a + '.{0,' + w + '}' + b + '|' + b + '.{0,' + w + '}' + a)
}
expected.debt_win = win

const keys = new Set([...Object.keys(expected), ...Object.keys(db)])
for (const k of keys) {
  if (JSON.stringify(expected[k]) !== JSON.stringify(db[k]))
    throw new Error('DB policy rules drift at "' + k + '": update the DB migration together with policy/job-posting-rules.json')
}
console.log('jobPolicyDbSync: DB trigger rules match policy/job-posting-rules.json (' + (rules as any).version + ') — all assertions passed')

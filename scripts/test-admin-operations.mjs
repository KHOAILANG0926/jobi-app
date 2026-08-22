import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL('../supabase/migrations/0009_admin_operations.sql', import.meta.url)
const sql = await readFile(migrationPath, 'utf8')

const required = [
  /add column if not exists origin text/i,
  /origin in \('crawler', 'employer', 'admin', 'legacy'\)/i,
  /add column if not exists admin_hidden boolean not null default false/i,
  /expected 649 jobs/i,
  /employer_count != 3 or crawler_count != 643 or legacy_count != 3/i,
  /create table if not exists public\.account_statuses/i,
  /create or replace function public\.is_account_active\(user_id uuid\)/i,
  /security definer[\s\S]*set search_path = pg_catalog, public/i,
  /create table if not exists public\.reports/i,
  /create table if not exists public\.admin_audit_logs/i,
  /create or replace function public\.admin_set_job_hidden/i,
  /create or replace function public\.admin_set_account_status/i,
  /create or replace function public\.admin_handle_report/i,
  /create or replace function public\.admin_list_users/i,
  /coalesce\(auth\.jwt\(\) -> 'app_metadata' ->> 'role', ''\) = 'admin'/i,
  /public\.is_account_active\(auth\.uid\(\)\)/i,
  /grant update \([\s\S]*\) on table public\.local_jobs to authenticated/i,
  /revoke all privileges on table public\.admin_audit_logs from anon, authenticated/i,
]

for (const pattern of required) {
  assert.match(sql, pattern, `missing admin migration contract: ${pattern}`)
}

assert.doesNotMatch(
  sql.match(/grant update \([\s\S]*?\) on table public\.local_jobs to authenticated/i)?.[0] ?? '',
  /admin_hidden|origin/i,
  'employers must not receive origin/admin_hidden column privileges',
)

const ownershipFragments = [
  /seeker_id = auth\.uid\(\) or employer_id = auth\.uid\(\)/i,
  /employer_id = auth\.uid\(\)/i,
  /user_id = auth\.uid\(\)/i,
  /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i,
]
for (const fragment of ownershipFragments) {
  assert.match(sql, fragment, `existing ownership predicate was not preserved: ${fragment}`)
}

console.log('Admin operations migration contract passed')

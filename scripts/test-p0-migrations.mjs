import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

async function read(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8')
}

function assertContains(source, patterns, label) {
  for (const pattern of patterns) {
    assert.match(source, pattern, `${label} is missing ${pattern}`)
  }
}

const audit = await read('supabase/audits/p0_foundation_readonly.sql')

assert.doesNotMatch(
  audit,
  /\b(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/i,
  'readonly audit must not contain data or schema mutations',
)

assertContains(audit, [
  /auth\.users/i,
  /raw_user_meta_data\s*->>\s*'role'/i,
  /local_jobs/i,
  /applications/i,
  /message_threads/i,
  /role_conflicts/i,
  /relrowsecurity/i,
  /pg_policies/i,
  /role_table_grants/i,
  /pg_publication_tables/i,
], 'readonly audit')

const rolesAndJobs = await read('supabase/migrations/0005_account_roles_local_jobs_rls.sql')

assertContains(rolesAndJobs, [
  /create table if not exists public\.account_roles/i,
  /user_id uuid primary key references auth\.users\s*\(id\) on delete cascade/i,
  /check\s*\(role in \('seeker', 'employer'\)\)/i,
  /create trigger on_auth_user_created/i,
  /raw_user_meta_data\s*->>\s*'role'/i,
  /raise exception 'account role conflicts detected/i,
  /alter table public\.account_roles enable row level security/i,
  /alter table public\.local_jobs enable row level security/i,
  /create policy local_jobs_public_select/i,
  /create policy local_jobs_employer_insert/i,
  /create policy local_jobs_employer_update/i,
  /create policy local_jobs_employer_delete/i,
  /app_metadata[^;]+admin/is,
  /employer_id = auth\.uid\(\)/i,
  /grant select on table public\.local_jobs to anon, authenticated/i,
  /grant select on table public\.account_roles to authenticated/i,
], 'account roles and local jobs migration')

assert.doesNotMatch(
  rolesAndJobs,
  /grant\s+update\s*\([^)]*employer_id/i,
  'authenticated update grant must not include employer_id',
)

const interviews = await read('supabase/migrations/0003_interviews.sql')

assertContains(interviews, [
  /id uuid primary key default gen_random_uuid\(\)/i,
  /job_id bigint not null references public\.local_jobs\(id\)/i,
  /seeker_id uuid not null references auth\.users\(id\)/i,
  /employer_id uuid not null references auth\.users\(id\)/i,
  /unique\s*\(job_id, seeker_id\)/i,
  /status in \('pending', 'confirmed', 'cancelled'\)/i,
  /l\.id = job_id and l\.employer_id = auth\.uid\(\)/i,
  /a\.job_id = interviews\.job_id/i,
  /a\.seeker_id = interviews\.seeker_id/i,
  /a\.employer_id = interviews\.employer_id/i,
  /grant update \(job_title, company, seeker_name, datetime, location, notes, status\)/i,
  /alter publication supabase_realtime add table public\.interviews/i,
], 'interviews migration')

assert.doesNotMatch(
  interviews,
  /grant\s+update\s*\([^)]*(job_id|seeker_id|employer_id)/i,
  'interviews update grant must not include ownership columns',
)

const profiles = await read('supabase/migrations/0006_user_profiles.sql')
const profileAdapter = await read('src/lib/accountProfileStorage.ts')

assertContains(profiles, [
  /create table if not exists public\.user_profiles/i,
  /user_id uuid primary key references auth\.users\(id\) on delete cascade/i,
  /alter table public\.user_profiles enable row level security/i,
  /for select to authenticated[\s\S]+user_id = auth\.uid\(\)/i,
  /for insert to authenticated[\s\S]+user_id = auth\.uid\(\)/i,
  /for update to authenticated[\s\S]+user_id = auth\.uid\(\)/i,
  /grant select, insert on table public\.user_profiles to authenticated/i,
  /grant update \(full_name, phone, email, city, bio, updated_at\)/i,
], 'user profiles migration')

assert.doesNotMatch(profiles, /grant\s+delete/i, 'user profiles must not grant client deletion')
assertContains(profileAdapter, [
  /export async function loadAccountProfile/i,
  /export async function saveAccountProfile/i,
  /user_id:/i,
  /throw new Error/i,
], 'account profile adapter')

const cvs = await read('supabase/migrations/0007_user_cvs.sql')
const cvAdapter = await read('src/lib/accountCvStorage.ts')

assertContains(cvs, [
  /create table if not exists public\.user_cvs/i,
  /user_id uuid primary key references auth\.users\(id\) on delete cascade/i,
  /cv_data jsonb not null/i,
  /jsonb_typeof\(cv_data\) = 'object'/i,
  /photo_path text/i,
  /alter table public\.user_cvs enable row level security/i,
  /for select to authenticated[\s\S]+user_id = auth\.uid\(\)/i,
  /for insert to authenticated[\s\S]+user_id = auth\.uid\(\)/i,
  /for update to authenticated[\s\S]+user_id = auth\.uid\(\)/i,
  /grant update \(cv_data, photo_path, updated_at\)/i,
], 'user cvs migration')

assert.doesNotMatch(cvs, /grant\s+delete/i, 'user cvs must not grant client deletion')
assertContains(cvAdapter, [
  /export async function loadAccountCv/i,
  /export async function saveAccountCv/i,
  /profilePhotoDataUrl: _photo/i,
  /cv_data:/i,
  /photo_path:/i,
], 'account cv adapter')

const cvPhotos = await read('supabase/migrations/0008_cv_photos_storage.sql')
const e2e = await read('scripts/e2e-p0-foundation.mjs')

assertContains(cvPhotos, [
  /values\s*\(\s*'cv-photos',\s*'cv-photos',\s*false/i,
  /1572864/i,
  /image\/jpeg/i,
  /image\/png/i,
  /image\/webp/i,
  /bucket_id = 'cv-photos'/i,
  /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i,
  /for select to authenticated/i,
  /for insert to authenticated/i,
  /for update to authenticated/i,
  /for delete to authenticated/i,
], 'cv photos migration')

assertContains(cvAdapter, [
  /export async function uploadCvPhoto/i,
  /export async function loadCvPhoto/i,
  /export async function deleteCvPhoto/i,
  /cv-photos/i,
  /startsWith\(`\$\{userId\}\/`\)/i,
], 'account cv photo adapter')

assertContains(e2e, [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /VGB E2E P0/,
  /employerA/,
  /employerB/,
  /seeker/,
  /outsider/,
  /user_metadata: \{ role:/,
  /finally/,
  /deleteUser/,
  /local_jobs/,
  /applications/,
  /interviews/,
  /user_profiles/,
  /user_cvs/,
  /cv-photos/,
  /postgres_changes/,
  /user_metadata role spoof/,
  /crawler application insert/,
  /interview without application/,
  /interview ownership column update/,
], 'p0 remote e2e harness')

console.log('p0 migration contracts: PASS')

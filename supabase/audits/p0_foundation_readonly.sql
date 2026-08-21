-- P0 foundation inspection. Every statement is read-only.

select
  coalesce(raw_user_meta_data ->> 'role', '<missing>') as metadata_role,
  count(*) as user_count
from auth.users
group by 1
order by 1;

with usage_evidence as (
  select
    u.id as user_id,
    coalesce(u.raw_user_meta_data ->> 'role', '<missing>') as metadata_role,
    exists (
      select 1 from public.local_jobs j where j.employer_id = u.id
    ) as owns_jobs,
    exists (
      select 1 from public.applications a where a.seeker_id = u.id
    ) as has_seeker_applications,
    exists (
      select 1 from public.applications a where a.employer_id = u.id
    ) as has_employer_applications,
    exists (
      select 1 from public.message_threads t where t.seeker_id = u.id
    ) as has_seeker_threads,
    exists (
      select 1 from public.message_threads t where t.employer_id = u.id
    ) as has_employer_threads
  from auth.users u
), role_conflicts as (
  select
    user_id,
    metadata_role,
    owns_jobs,
    has_seeker_applications,
    has_employer_applications,
    has_seeker_threads,
    has_employer_threads,
    case
      when metadata_role not in ('seeker', 'employer') then 'missing_or_invalid_metadata_role'
      when metadata_role = 'seeker'
        and (owns_jobs or has_employer_applications or has_employer_threads)
        then 'seeker_with_employer_history'
      when metadata_role = 'employer'
        and (has_seeker_applications or has_seeker_threads)
        then 'employer_with_seeker_history'
    end as conflict_reason
  from usage_evidence
)
select *
from role_conflicts
where conflict_reason is not null
order by user_id;

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'local_jobs',
    'applications',
    'message_threads',
    'messages',
    'interviews',
    'account_roles',
    'user_profiles',
    'user_cvs'
  )
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'local_jobs',
    'applications',
    'message_threads',
    'messages',
    'interviews',
    'account_roles',
    'user_profiles',
    'user_cvs'
  )
order by tablename, policyname;

select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'local_jobs',
    'applications',
    'message_threads',
    'messages',
    'interviews',
    'account_roles',
    'user_profiles',
    'user_cvs'
  )
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'applications',
    'message_threads',
    'messages',
    'interviews'
  )
order by tablename;

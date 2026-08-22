select
  count(*) as total,
  count(*) filter (where employer_id is not null) as employer,
  count(*) filter (where employer_id is null and coalesce(description, '') ilike '%[source:vieclam24h]%') as crawler,
  count(*) filter (where employer_id is null and coalesce(description, '') not ilike '%[source:vieclam24h]%') as legacy
from public.local_jobs;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and tablename in ('local_jobs','applications','message_threads','messages','interviews','user_profiles','user_cvs','objects')
order by schemaname, tablename, policyname;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and table_name in ('local_jobs','applications','message_threads','messages','interviews','user_profiles','user_cvs','objects')
  and grantee in ('anon','authenticated')
order by table_schema, table_name, grantee, privilege_type;

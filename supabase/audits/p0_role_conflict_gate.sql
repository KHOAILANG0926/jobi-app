-- Machine-readable safety gate. A non-zero result forbids migration 0005.
with usage_evidence as (
  select
    u.id as user_id,
    coalesce(u.raw_user_meta_data ->> 'role', '<missing>') as metadata_role,
    exists (select 1 from public.local_jobs j where j.employer_id = u.id) as owns_jobs,
    exists (select 1 from public.applications a where a.seeker_id = u.id) as has_seeker_apps,
    exists (select 1 from public.applications a where a.employer_id = u.id) as has_employer_apps,
    exists (select 1 from public.message_threads t where t.seeker_id = u.id) as has_seeker_threads,
    exists (select 1 from public.message_threads t where t.employer_id = u.id) as has_employer_threads
  from auth.users u
)
select count(*)
from usage_evidence
where metadata_role not in ('seeker', 'employer')
   or (metadata_role = 'seeker' and (owns_jobs or has_employer_apps or has_employer_threads))
   or (metadata_role = 'employer' and (has_seeker_apps or has_seeker_threads));

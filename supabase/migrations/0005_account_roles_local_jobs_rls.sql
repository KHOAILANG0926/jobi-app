-- Server-backed account roles and local_jobs ownership policies.
-- Existing user roles are backfilled only when metadata and observed usage do not conflict.

begin;

create table if not exists public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('seeker', 'employer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  conflict_count integer;
begin
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
  select count(*) into conflict_count
  from usage_evidence
  where metadata_role not in ('seeker', 'employer')
     or (
       metadata_role = 'seeker'
       and (owns_jobs or has_employer_apps or has_employer_threads)
     )
     or (
       metadata_role = 'employer'
       and (has_seeker_apps or has_seeker_threads)
     );

  if conflict_count > 0 then
    raise exception 'account role conflicts detected: % user(s); run the readonly audit before retrying', conflict_count;
  end if;
end
$$;

insert into public.account_roles (user_id, role)
select u.id, u.raw_user_meta_data ->> 'role'
from auth.users u
where u.raw_user_meta_data ->> 'role' in ('seeker', 'employer')
on conflict (user_id) do nothing;

create or replace function public.handle_new_auth_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := new.raw_user_meta_data ->> 'role';
  if requested_role not in ('seeker', 'employer') then
    requested_role := 'seeker';
  end if;

  insert into public.account_roles (user_id, role)
  values (new.id, requested_role)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_role();

alter table public.account_roles enable row level security;

drop policy if exists account_roles_select_own on public.account_roles;
create policy account_roles_select_own on public.account_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

revoke all privileges on table public.account_roles from anon, authenticated;
grant select on table public.account_roles to authenticated;

alter table public.local_jobs enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'local_jobs'
  loop
    execute format('drop policy if exists %I on public.local_jobs', existing_policy.policyname);
  end loop;
end
$$;

create policy local_jobs_public_select on public.local_jobs
  for select to anon, authenticated
  using (true);

create policy local_jobs_employer_insert on public.local_jobs
  for insert to authenticated
  with check (
    (
      employer_id = auth.uid()
      and exists (
        select 1 from public.account_roles ar
        where ar.user_id = auth.uid() and ar.role = 'employer'
      )
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

create policy local_jobs_employer_update on public.local_jobs
  for update to authenticated
  using (
    (
      employer_id = auth.uid()
      and exists (
        select 1 from public.account_roles ar
        where ar.user_id = auth.uid() and ar.role = 'employer'
      )
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  with check (
    (
      employer_id = auth.uid()
      and exists (
        select 1 from public.account_roles ar
        where ar.user_id = auth.uid() and ar.role = 'employer'
      )
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

create policy local_jobs_employer_delete on public.local_jobs
  for delete to authenticated
  using (
    (
      employer_id = auth.uid()
      and exists (
        select 1 from public.account_roles ar
        where ar.user_id = auth.uid() and ar.role = 'employer'
      )
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

revoke all privileges on table public.local_jobs from anon, authenticated;
grant select on table public.local_jobs to anon, authenticated;
grant insert on table public.local_jobs to authenticated;
grant delete on table public.local_jobs to authenticated;
grant update (
  title,
  company,
  category,
  salary,
  location,
  hours,
  employer_phone,
  application_deadline,
  urgent,
  description,
  lat,
  lng,
  active,
  image_url,
  work_period,
  work_days,
  education,
  preference,
  num_hires,
  company_verified,
  company_founded_year,
  hire_count,
  images
) on table public.local_jobs to authenticated;

commit;

-- Admin operations, reporting, append-only audit, and immediate account suspension.
-- Approved operating backfill gate: expected 649 jobs = employer 3 + crawler 643 + legacy 3.

begin;

do $$
declare
  total_count integer;
  employer_count integer;
  crawler_count integer;
  legacy_count integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'origin'
  ) then
    select
      count(*),
      count(*) filter (where employer_id is not null),
      count(*) filter (
        where employer_id is null
          and coalesce(description, '') ilike '%[source:vieclam24h]%'
      ),
      count(*) filter (
        where employer_id is null
          and coalesce(description, '') not ilike '%[source:vieclam24h]%'
      )
    into total_count, employer_count, crawler_count, legacy_count
    from public.local_jobs;

    if total_count != 649 or employer_count != 3 or crawler_count != 643 or legacy_count != 3 then
      raise exception
        'local_jobs origin backfill mismatch: total %, employer %, crawler %, legacy %',
        total_count, employer_count, crawler_count, legacy_count;
    end if;
  end if;
end
$$;

alter table public.local_jobs
  add column if not exists origin text,
  add column if not exists admin_hidden boolean not null default false;

update public.local_jobs
set origin = case
  when employer_id is not null then 'employer'
  when coalesce(description, '') ilike '%[source:vieclam24h]%' then 'crawler'
  else 'legacy'
end
where origin is null;

alter table public.local_jobs
  alter column origin set default 'legacy',
  alter column origin set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'local_jobs_origin_check'
      and conrelid = 'public.local_jobs'::regclass
  ) then
    alter table public.local_jobs
      add constraint local_jobs_origin_check
      check (origin in ('crawler', 'employer', 'admin', 'legacy'));
  end if;
end
$$;

create table if not exists public.account_statuses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  reason text,
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.account_statuses (user_id, status)
select id, 'active' from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_auth_user_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.account_statuses (user_id, status)
  values (new.id, 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_status on auth.users;
create trigger on_auth_user_created_status
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_status();

create or replace function public.is_account_active(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select user_id is not null and exists (
    select 1 from public.account_statuses s
    where s.user_id = $1 and s.status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_account_active(uuid) from public;
grant execute on function public.is_account_active(uuid) to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.account_statuses enable row level security;
drop policy if exists account_statuses_select_own_or_admin on public.account_statuses;
create policy account_statuses_select_own_or_admin on public.account_statuses
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all privileges on table public.account_statuses from anon, authenticated;
grant select on table public.account_statuses to authenticated;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  target_type text not null check (target_type in ('job', 'user', 'community_post')),
  target_id text not null,
  category text not null,
  description text not null default '',
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by uuid references auth.users(id),
  handled_at timestamptz
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists reports_insert_own_active on public.reports;
drop policy if exists reports_select_own_or_admin on public.reports;
create policy reports_insert_own_active on public.reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and handled_by is null
    and handled_at is null
    and public.is_account_active(auth.uid())
  );
create policy reports_select_own_or_admin on public.reports
  for select to authenticated
  using (
    (reporter_id = auth.uid() and public.is_account_active(auth.uid()))
    or public.is_admin()
  );

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin on public.admin_audit_logs
  for select to authenticated using (public.is_admin());

revoke all privileges on table public.reports from anon, authenticated;
grant select, insert on table public.reports to authenticated;
revoke all privileges on table public.admin_audit_logs from anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;

create or replace function public.require_admin()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare caller uuid := auth.uid();
begin
  if caller is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return caller;
end;
$$;
revoke all on function public.require_admin() from public;

create or replace function public.admin_set_job_hidden(
  target_job_id bigint,
  hidden boolean,
  reason text default ''
)
returns public.local_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); result public.local_jobs;
begin
  update public.local_jobs set admin_hidden = hidden
  where id = target_job_id returning * into result;
  if result.id is null then raise exception 'job not found'; end if;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, case when hidden then 'job.hide' else 'job.unhide' end,
    'job', target_job_id::text, jsonb_build_object('reason', coalesce(reason, '')));
  return result;
end;
$$;

create or replace function public.admin_set_account_status(
  target_user_id uuid,
  next_status text,
  reason text default ''
)
returns public.account_statuses
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); result public.account_statuses;
begin
  if next_status not in ('active', 'suspended') then raise exception 'invalid account status'; end if;
  if target_user_id = caller then raise exception 'admin cannot suspend self'; end if;
  if coalesce((select raw_app_meta_data ->> 'role' from auth.users where id = target_user_id), '') = 'admin' then
    raise exception 'admin accounts require a separate privileged procedure';
  end if;
  insert into public.account_statuses(user_id, status, reason, suspended_at, suspended_by, updated_at)
  values (
    target_user_id, next_status, nullif(trim(reason), ''),
    case when next_status = 'suspended' then now() else null end,
    case when next_status = 'suspended' then caller else null end, now()
  )
  on conflict (user_id) do update set
    status = excluded.status,
    reason = excluded.reason,
    suspended_at = excluded.suspended_at,
    suspended_by = excluded.suspended_by,
    updated_at = now()
  returning * into result;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, 'user.' || next_status, 'user', target_user_id::text,
    jsonb_build_object('reason', coalesce(reason, '')));
  return result;
end;
$$;

create or replace function public.admin_handle_report(
  target_report_id uuid,
  next_status text,
  note text default ''
)
returns public.reports
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); result public.reports;
begin
  if next_status not in ('reviewing', 'resolved', 'rejected') then raise exception 'invalid report status'; end if;
  update public.reports set
    status = next_status,
    updated_at = now(),
    handled_by = caller,
    handled_at = now()
  where id = target_report_id returning * into result;
  if result.id is null then raise exception 'report not found'; end if;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, 'report.' || next_status, 'report', target_report_id::text,
    jsonb_build_object('note', coalesce(note, '')));
  return result;
end;
$$;

create or replace function public.admin_create_job(payload jsonb)
returns public.local_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); result public.local_jobs;
begin
  if nullif(trim(payload ->> 'title'), '') is null or nullif(trim(payload ->> 'company'), '') is null then
    raise exception 'title and company are required';
  end if;
  insert into public.local_jobs (
    title, company, category, salary, location, hours, employer_phone,
    application_deadline, urgent, description, posted_at, lat, lng, image_url,
    active, work_period, work_days, education, preference, num_hires,
    company_verified, company_founded_year, hire_count, origin, admin_hidden
  ) values (
    payload ->> 'title', payload ->> 'company', coalesce(payload ->> 'category', 'other'),
    coalesce(payload ->> 'salary', ''), coalesce(payload ->> 'location', ''), payload ->> 'hours',
    payload ->> 'employer_phone', nullif(payload ->> 'application_deadline', '')::date,
    coalesce((payload ->> 'urgent')::boolean, false), coalesce(payload ->> 'description', ''),
    coalesce(nullif(payload ->> 'posted_at', '')::date, current_date),
    nullif(payload ->> 'lat', '')::double precision, nullif(payload ->> 'lng', '')::double precision,
    payload ->> 'image_url', true, payload ->> 'work_period', payload ->> 'work_days',
    payload ->> 'education', payload ->> 'preference', payload ->> 'num_hires',
    coalesce((payload ->> 'company_verified')::boolean, false),
    nullif(payload ->> 'company_founded_year', '')::integer,
    nullif(payload ->> 'hire_count', '')::integer, 'admin', false
  ) returning * into result;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, 'job.create', 'job', result.id::text,
    jsonb_build_object('title', result.title, 'origin', 'admin'));
  return result;
end;
$$;

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  role text,
  status text,
  joined_at timestamptz,
  display_name text,
  job_count bigint,
  application_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  return query
  select u.id, ar.role, s.status, u.created_at, coalesce(p.full_name, ''),
    (select count(*) from public.local_jobs j where j.employer_id = u.id),
    (select count(*) from public.applications a where a.seeker_id = u.id)
  from auth.users u
  left join public.account_roles ar on ar.user_id = u.id
  join public.account_statuses s on s.user_id = u.id
  left join public.user_profiles p on p.user_id = u.id
  where coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_set_job_hidden(bigint, boolean, text) from public;
revoke all on function public.admin_set_account_status(uuid, text, text) from public;
revoke all on function public.admin_handle_report(uuid, text, text) from public;
revoke all on function public.admin_create_job(jsonb) from public;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_set_job_hidden(bigint, boolean, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
grant execute on function public.admin_handle_report(uuid, text, text) to authenticated;
grant execute on function public.admin_create_job(jsonb) to authenticated;
grant execute on function public.admin_list_users() to authenticated;

-- local_jobs: public rows stay public, hidden rows are admin-only. Ownership is unchanged.
drop policy if exists local_jobs_public_select on public.local_jobs;
drop policy if exists local_jobs_employer_insert on public.local_jobs;
drop policy if exists local_jobs_employer_update on public.local_jobs;
drop policy if exists local_jobs_employer_delete on public.local_jobs;
create policy local_jobs_public_select on public.local_jobs for select to anon, authenticated
  using (admin_hidden = false or public.is_admin());
create policy local_jobs_employer_insert on public.local_jobs for insert to authenticated
  with check (
    public.is_account_active(auth.uid())
    and employer_id = auth.uid()
    and origin = 'employer'
    and admin_hidden = false
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  );
create policy local_jobs_employer_update on public.local_jobs for update to authenticated
  using (
    public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  )
  with check (
    public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  );
create policy local_jobs_employer_delete on public.local_jobs for delete to authenticated
  using (
    public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  );

-- origin/admin_hidden are intentionally absent: employers cannot alter operating ownership/visibility.
revoke all privileges on table public.local_jobs from anon, authenticated;
grant select on table public.local_jobs to anon, authenticated;
grant insert, delete on table public.local_jobs to authenticated;
grant update (
  title, company, category, salary, location, hours, employer_phone,
  application_deadline, urgent, description, lat, lng, active, image_url,
  work_period, work_days, education, preference, num_hires, company_verified,
  company_founded_year, hire_count, images
) on table public.local_jobs to authenticated;

-- Foundation policies retain every ownership predicate and add only active-account checks.
drop policy if exists applications_select on public.applications;
drop policy if exists applications_insert on public.applications;
drop policy if exists applications_update_by_employer on public.applications;
drop policy if exists applications_delete_by_seeker on public.applications;
create policy applications_select on public.applications for select to authenticated
  using (public.is_account_active(auth.uid()) and (seeker_id = auth.uid() or employer_id = auth.uid()));
create policy applications_insert on public.applications for insert to authenticated
  with check (public.is_account_active(auth.uid()) and seeker_id = auth.uid() and status = 'submitted'
    and exists (select 1 from public.local_jobs l where l.id = job_id and l.employer_id is not null and l.employer_id = employer_id));
create policy applications_update_by_employer on public.applications for update to authenticated
  using (public.is_account_active(auth.uid()) and employer_id = auth.uid())
  with check (public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and status in ('reviewing', 'interview', 'accepted', 'rejected'));
create policy applications_delete_by_seeker on public.applications for delete to authenticated
  using (public.is_account_active(auth.uid()) and seeker_id = auth.uid());

drop policy if exists message_threads_select on public.message_threads;
drop policy if exists message_threads_insert on public.message_threads;
drop policy if exists message_threads_update on public.message_threads;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
create policy message_threads_select on public.message_threads for select to authenticated
  using (public.is_account_active(auth.uid()) and (seeker_id = auth.uid() or employer_id = auth.uid()));
create policy message_threads_insert on public.message_threads for insert to authenticated
  with check (public.is_account_active(auth.uid()) and seeker_id = auth.uid()
    and exists (select 1 from public.local_jobs l where l.id = job_id and l.employer_id is not null and l.employer_id = employer_id));
create policy message_threads_update on public.message_threads for update to authenticated
  using (public.is_account_active(auth.uid()) and (seeker_id = auth.uid() or employer_id = auth.uid()))
  with check (public.is_account_active(auth.uid()) and (seeker_id = auth.uid() or employer_id = auth.uid()));
create policy messages_select on public.messages for select to authenticated
  using (public.is_account_active(auth.uid()) and exists (
    select 1 from public.message_threads mt where mt.id = messages.thread_id
      and (mt.seeker_id = auth.uid() or mt.employer_id = auth.uid())));
create policy messages_insert on public.messages for insert to authenticated
  with check (public.is_account_active(auth.uid()) and exists (
    select 1 from public.message_threads mt where mt.id = messages.thread_id and (
      (messages.from_role = 'seeker' and mt.seeker_id = auth.uid())
      or (messages.from_role = 'employer' and mt.employer_id = auth.uid()))));

drop policy if exists interviews_select on public.interviews;
drop policy if exists interviews_insert on public.interviews;
drop policy if exists interviews_update on public.interviews;
create policy interviews_select on public.interviews for select to authenticated
  using (public.is_account_active(auth.uid()) and (seeker_id = auth.uid() or employer_id = auth.uid()));
create policy interviews_insert on public.interviews for insert to authenticated
  with check (public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.local_jobs l where l.id = job_id and l.employer_id = auth.uid())
    and exists (select 1 from public.applications a where a.job_id = interviews.job_id
      and a.seeker_id = interviews.seeker_id and a.employer_id = interviews.employer_id));
create policy interviews_update on public.interviews for update to authenticated
  using (public.is_account_active(auth.uid()) and employer_id = auth.uid())
  with check (public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.local_jobs l where l.id = job_id and l.employer_id = auth.uid())
    and exists (select 1 from public.applications a where a.job_id = interviews.job_id
      and a.seeker_id = interviews.seeker_id and a.employer_id = interviews.employer_id));

drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles for select to authenticated
  using (public.is_account_active(auth.uid()) and user_id = auth.uid());
create policy user_profiles_insert_own on public.user_profiles for insert to authenticated
  with check (public.is_account_active(auth.uid()) and user_id = auth.uid());
create policy user_profiles_update_own on public.user_profiles for update to authenticated
  using (public.is_account_active(auth.uid()) and user_id = auth.uid())
  with check (public.is_account_active(auth.uid()) and user_id = auth.uid());

drop policy if exists user_cvs_select_own on public.user_cvs;
drop policy if exists user_cvs_insert_own on public.user_cvs;
drop policy if exists user_cvs_update_own on public.user_cvs;
create policy user_cvs_select_own on public.user_cvs for select to authenticated
  using (public.is_account_active(auth.uid()) and user_id = auth.uid());
create policy user_cvs_insert_own on public.user_cvs for insert to authenticated
  with check (public.is_account_active(auth.uid()) and user_id = auth.uid());
create policy user_cvs_update_own on public.user_cvs for update to authenticated
  using (public.is_account_active(auth.uid()) and user_id = auth.uid())
  with check (public.is_account_active(auth.uid()) and user_id = auth.uid());

drop policy if exists cv_photos_select_own on storage.objects;
drop policy if exists cv_photos_insert_own on storage.objects;
drop policy if exists cv_photos_update_own on storage.objects;
drop policy if exists cv_photos_delete_own on storage.objects;
create policy cv_photos_select_own on storage.objects for select to authenticated
  using (public.is_account_active(auth.uid()) and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy cv_photos_insert_own on storage.objects for insert to authenticated
  with check (public.is_account_active(auth.uid()) and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy cv_photos_update_own on storage.objects for update to authenticated
  using (public.is_account_active(auth.uid()) and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text)
  with check (public.is_account_active(auth.uid()) and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy cv_photos_delete_own on storage.objects for delete to authenticated
  using (public.is_account_active(auth.uid()) and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text);

commit;

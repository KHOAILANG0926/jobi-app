-- Interviews: 기업이 자기 직접등록 공고의 실제 지원자에게 일정을 잡고,
-- 해당 기업과 구직자만 조회한다. 공고/지원자/기업 소유권 열은 생성 후 불변이다.

begin;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.local_jobs(id),
  seeker_id uuid not null references auth.users(id),
  employer_id uuid not null references auth.users(id),
  job_title text,
  company text,
  seeker_name text,
  datetime timestamptz not null,
  location text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'interviews_status_check'
      and conrelid = 'public.interviews'::regclass
  ) then
    alter table public.interviews
      add constraint interviews_status_check
      check (status in ('pending', 'confirmed', 'cancelled'));
  end if;
end
$$;

alter table public.interviews enable row level security;

drop policy if exists interviews_select on public.interviews;
drop policy if exists interviews_insert on public.interviews;
drop policy if exists interviews_update on public.interviews;

create policy interviews_select on public.interviews
  for select to authenticated
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy interviews_insert on public.interviews
  for insert to authenticated
  with check (
    employer_id = auth.uid()
    and exists (
      select 1 from public.local_jobs l
      where l.id = job_id and l.employer_id = auth.uid()
    )
    and exists (
      select 1 from public.applications a
      where a.job_id = interviews.job_id
        and a.seeker_id = interviews.seeker_id
        and a.employer_id = interviews.employer_id
    )
  );

create policy interviews_update on public.interviews
  for update to authenticated
  using (employer_id = auth.uid())
  with check (
    employer_id = auth.uid()
    and exists (
      select 1 from public.local_jobs l
      where l.id = job_id and l.employer_id = auth.uid()
    )
    and exists (
      select 1 from public.applications a
      where a.job_id = interviews.job_id
        and a.seeker_id = interviews.seeker_id
        and a.employer_id = interviews.employer_id
    )
  );

revoke all privileges on table public.interviews from anon, authenticated;
grant select, insert on table public.interviews to authenticated;
grant update (job_title, company, seeker_name, datetime, location, notes, status)
  on table public.interviews to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'interviews'
  ) then
    alter publication supabase_realtime add table public.interviews;
  end if;
end
$$;

commit;

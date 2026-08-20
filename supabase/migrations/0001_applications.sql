-- Applications: 구직자가 기업 직접등록 공고에 지원한 내역.
-- job_id는 local_jobs.id(bigint)를 참조한다. 프론트엔드의 Job.id는 "sb-<id>" 형태의
-- 문자열이므로 저장 계층 경계(src/lib/jobId.ts)에서 접두사를 떼고/붙여 변환한다.
--
-- 권한 모델:
--   생성 — 구직자 본인만, status는 항상 'submitted'로 고정, employer_id는 해당
--          공고(local_jobs)의 실제 소유 기업과 반드시 일치해야 함. employer_id가
--          NULL인 크롤링/관리자 공고는 내부 지원 생성 불가.
--   상태 변경 — 해당 공고 기업만, reviewing/interview/accepted/rejected 중으로만
--               변경 가능. job_id/seeker_id/employer_id 등 다른 열은 변경 불가.
--   취소 — 구직자 본인만 자기 지원을 DELETE로 취소 가능(상태값 변경이 아님).
--
begin;

-- 신규 DB에서는 파일명 순서상 0001이 0004보다 먼저 실행된다. 동일한 IF NOT EXISTS
-- 정의를 선행해 순차 migration과 이미 0004가 적용된 운영 DB를 모두 지원한다.
alter table public.local_jobs
  add column if not exists employer_id uuid references auth.users(id);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.local_jobs(id),
  seeker_id uuid not null references auth.users(id),
  employer_id uuid not null references auth.users(id),
  job_title text,
  company text,
  seeker_name text,
  seeker_phone text,
  status text not null default 'submitted',
  status_history jsonb not null default '[]',
  applied_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

-- 부분 적용된 기존 테이블에 고아 지원이 있다면 임의 보정하지 않고 전체 migration을
-- 중단한다. 데이터 삭제/소유권 추정은 사람의 판단이 필요한 작업이다.
do $$
begin
  if exists (
    select 1
    from public.applications
    where employer_id is null
  ) then
    raise exception 'applications contains rows with NULL employer_id';
  end if;
end
$$;

alter table public.applications
  alter column employer_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_status_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_status_check
      check (
        status in ('submitted', 'reviewing', 'interview', 'accepted', 'rejected')
      );
  end if;
end
$$;

alter table public.applications enable row level security;

drop policy if exists applications_select on public.applications;
drop policy if exists applications_insert on public.applications;
drop policy if exists applications_update_by_employer on public.applications;
drop policy if exists applications_delete_by_seeker on public.applications;

create policy applications_select on public.applications
  for select
  to authenticated
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy applications_insert on public.applications
  for insert
  to authenticated
  with check (
    seeker_id = auth.uid()
    and status = 'submitted'
    and exists (
      select 1
      from public.local_jobs l
      where l.id = job_id
        and l.employer_id is not null
        and l.employer_id = employer_id
    )
  );

create policy applications_update_by_employer on public.applications
  for update
  to authenticated
  using (employer_id = auth.uid())
  with check (
    employer_id = auth.uid()
    and status in ('reviewing', 'interview', 'accepted', 'rejected')
  );

create policy applications_delete_by_seeker on public.applications
  for delete
  to authenticated
  using (seeker_id = auth.uid());

-- RLS는 행 단위 권한만 제한한다. 기업이 UPDATE 요청에서 지원 상태 외의
-- job_id/seeker_id/employer_id 등을 함께 바꾸지 못하도록 열 권한도 제한한다.
revoke all privileges on table public.applications from anon, authenticated;
grant select, insert, delete on table public.applications to authenticated;
grant update (status, status_history) on table public.applications to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;
end
$$;

commit;

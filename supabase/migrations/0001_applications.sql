-- Applications: 구직자가 공고에 지원한 내역.
-- job_id는 local_jobs.id(bigint)를 참조한다. 프론트엔드의 Job.id는 "sb-<id>" 형태의
-- 문자열이므로 저장 계층 경계(src/lib/jobId.ts)에서 접두사를 떼고/붙여 변환한다.
--
-- 권한 모델:
--   생성 — 구직자 본인만, status는 항상 'submitted'로 고정, employer_id는 해당
--          공고(local_jobs)의 실제 소유 기업과 반드시 일치해야 함(위조 방지).
--   상태 변경 — 해당 공고 기업만, reviewing/interview/accepted/rejected 중으로만
--               (submitted로 되돌리는 것도 금지).
--   취소 — 구직자 본인만 자기 지원을 DELETE로 취소 가능(상태값 변경이 아님).

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references local_jobs(id),
  seeker_id uuid not null references auth.users(id),
  employer_id uuid references auth.users(id),
  job_title text,
  company text,
  seeker_name text,
  seeker_phone text,
  status text not null default 'submitted',
  status_history jsonb not null default '[]',
  applied_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

alter table applications enable row level security;

create policy applications_select on applications
  for select
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy applications_insert on applications
  for insert
  with check (
    seeker_id = auth.uid()
    and status = 'submitted'
    and employer_id is not distinct from (
      select l.employer_id from local_jobs l where l.id = job_id
    )
  );

create policy applications_update_by_employer on applications
  for update
  using (employer_id = auth.uid())
  with check (
    employer_id = auth.uid()
    and status in ('reviewing', 'interview', 'accepted', 'rejected')
  );

create policy applications_delete_by_seeker on applications
  for delete
  using (seeker_id = auth.uid());

alter publication supabase_realtime add table applications;

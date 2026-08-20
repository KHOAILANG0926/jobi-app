-- Interview slots. job_id references local_jobs.id(bigint); see 0001_applications.sql.
-- unique(job_id, seeker_id) is an addition on top of the originally requested schema:
-- the old scheduleInterview() semantics were "replace the prior slot for this
-- (job, seeker) pair", which we reproduce here via .upsert(onConflict: job_id,seeker_id).

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references local_jobs(id),
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

alter table interviews enable row level security;

create policy interviews_select on interviews
  for select
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy interviews_insert on interviews
  for insert
  with check (employer_id = auth.uid());

create policy interviews_update on interviews
  for update
  using (seeker_id = auth.uid() or employer_id = auth.uid());

alter publication supabase_realtime add table interviews;

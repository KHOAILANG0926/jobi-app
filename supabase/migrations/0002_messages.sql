-- Message threads (1 per job+seeker pair) and messages within a thread.
-- job_id references local_jobs.id(bigint); see 0001_applications.sql for rationale.

create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references local_jobs(id),
  seeker_id uuid not null references auth.users(id),
  employer_id uuid references auth.users(id),
  job_title text,
  company text,
  employer_phone text,
  seeker_name text,
  unread_by_seeker boolean default false,
  unread_by_employer boolean default false,
  updated_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  from_role text not null check (from_role in ('seeker', 'employer')),
  body text not null,
  sent_at timestamptz not null default now()
);

alter table message_threads enable row level security;
alter table messages enable row level security;

create policy message_threads_select on message_threads
  for select
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy message_threads_insert on message_threads
  for insert
  with check (seeker_id = auth.uid());

create policy message_threads_update on message_threads
  for update
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy messages_select on messages
  for select
  using (
    exists (
      select 1 from message_threads mt
      where mt.id = messages.thread_id
        and (mt.seeker_id = auth.uid() or mt.employer_id = auth.uid())
    )
  );

create policy messages_insert on messages
  for insert
  with check (
    exists (
      select 1 from message_threads mt
      where mt.id = messages.thread_id
        and (
          (messages.from_role = 'seeker' and mt.seeker_id = auth.uid())
          or (messages.from_role = 'employer' and mt.employer_id = auth.uid())
        )
    )
  );

alter publication supabase_realtime add table message_threads;
alter publication supabase_realtime add table messages;

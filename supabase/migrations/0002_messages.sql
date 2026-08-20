-- Message threads: 기업 직접등록 공고+구직자 조합당 1개.
-- Messages: 해당 스레드의 구직자와 공고 소유 기업만 읽고 자신의 역할로 전송한다.

begin;

-- 신규 DB의 순차 migration과 이미 0004가 적용된 운영 DB를 모두 지원한다.
alter table public.local_jobs
  add column if not exists employer_id uuid references auth.users(id);

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.local_jobs(id),
  seeker_id uuid not null references auth.users(id),
  employer_id uuid not null references auth.users(id),
  job_title text,
  company text,
  employer_phone text,
  seeker_name text,
  unread_by_seeker boolean not null default false,
  unread_by_employer boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  from_role text not null check (from_role in ('seeker', 'employer')),
  body text not null,
  sent_at timestamptz not null default now()
);

-- 부분 적용된 기존 테이블에 소유 기업 없는 스레드가 있으면 임의 보정하지 않는다.
do $$
begin
  if exists (
    select 1
    from public.message_threads
    where employer_id is null
  ) then
    raise exception 'message_threads contains rows with NULL employer_id';
  end if;
end
$$;

alter table public.message_threads
  alter column employer_id set not null,
  alter column unread_by_seeker set not null,
  alter column unread_by_employer set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_body_not_blank'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_body_not_blank check (length(trim(body)) > 0);
  end if;
end
$$;

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

drop policy if exists message_threads_select on public.message_threads;
drop policy if exists message_threads_insert on public.message_threads;
drop policy if exists message_threads_update on public.message_threads;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;

create policy message_threads_select on public.message_threads
  for select
  to authenticated
  using (seeker_id = auth.uid() or employer_id = auth.uid());

create policy message_threads_insert on public.message_threads
  for insert
  to authenticated
  with check (
    seeker_id = auth.uid()
    and exists (
      select 1
      from public.local_jobs l
      where l.id = job_id
        and l.employer_id is not null
        and l.employer_id = employer_id
    )
  );

create policy message_threads_update on public.message_threads
  for update
  to authenticated
  using (seeker_id = auth.uid() or employer_id = auth.uid())
  with check (seeker_id = auth.uid() or employer_id = auth.uid());

create policy messages_select on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = messages.thread_id
        and (mt.seeker_id = auth.uid() or mt.employer_id = auth.uid())
    )
  );

create policy messages_insert on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = messages.thread_id
        and (
          (messages.from_role = 'seeker' and mt.seeker_id = auth.uid())
          or (messages.from_role = 'employer' and mt.employer_id = auth.uid())
        )
    )
  );

-- 참여자는 읽음 표시와 정렬 시각만 바꿀 수 있다. 스레드 소유권과 표시 정보는 불변이다.
revoke all privileges on table public.message_threads from anon, authenticated;
grant select, insert on table public.message_threads to authenticated;
grant update (unread_by_seeker, unread_by_employer, updated_at)
  on table public.message_threads to authenticated;

revoke all privileges on table public.messages from anon, authenticated;
grant select, insert on table public.messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_threads'
  ) then
    alter publication supabase_realtime add table public.message_threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

commit;

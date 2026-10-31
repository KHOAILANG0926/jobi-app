begin;
create table if not exists public.job_reprocess_queue (
 id bigint generated always as identity primary key,
 job_id bigint not null references public.local_jobs(id) on delete cascade,
 rule_version text not null,
 reason text not null check (length(reason) between 1 and 120),
 status text not null default 'pending' check(status in ('pending','running','success','failed','blocked')),
 attempts integer not null default 0,
 requested_at timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz,
 result jsonb,
 error text,
 unique(job_id,rule_version)
);
create index if not exists job_reprocess_queue_pending on public.job_reprocess_queue(status,requested_at) where status='pending';
alter table public.job_reprocess_queue enable row level security;
revoke all on public.job_reprocess_queue from public,anon,authenticated;
grant select,insert,update on public.job_reprocess_queue to service_role;
grant usage,select on sequence public.job_reprocess_queue_id_seq to service_role;
commit;

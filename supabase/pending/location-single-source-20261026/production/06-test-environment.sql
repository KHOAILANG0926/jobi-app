-- Test-only auth and hook dependencies. No remote calls are possible.
alter table public.local_jobs enable row level security;
alter table public.job_work_locations enable row level security;
alter table public.job_location_candidates enable row level security;
alter table public.admin_confirmed_location_memory enable row level security;
alter table public.map_r1_location_jobs enable row level security;
alter table public.map_r1_search_history enable row level security;
alter table public.admin_audit_logs enable row level security;
create policy public_jobs on public.local_jobs for select to anon,authenticated using(active and not admin_hidden);
create policy job_work_locations_public_select on public.job_work_locations for select to anon,authenticated using(true);
grant usage on schema public,auth to anon,authenticated,service_role;
grant select on public.local_jobs,public.job_work_locations to anon,authenticated;
grant all on public.local_jobs,public.job_work_locations,public.job_location_candidates,public.admin_confirmed_location_memory,public.map_r1_location_jobs,public.map_r1_search_history,public.admin_audit_logs to service_role;
grant usage,select on all sequences in schema public to service_role;
create function public.is_account_active(uuid) returns boolean language sql stable as $$select true$$;
-- Real require_admin is installed separately; this table is its production lookup.
create table public.user_profiles(user_id uuid primary key,status text default 'active',role text);
create function public.map_r1_request_location(bigint) returns void language plpgsql as $$begin return;end$$;
create function public.map_r1_public_points(bigint[]) returns table(job_id bigint,result jsonb) language sql as $$select null::bigint,null::jsonb where false$$;

create table public.job_posting_rules(id bigint generated always as identity primary key,rule_key text unique not null,content text not null,decided_on date not null,machine_checkable text not null,block_mode text not null,implementation text,last_test_result text,last_tested_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());

-- Gate lexer regression: BEGIN in strings/comments precedes the executable block.
create function public.location_gate_fixture_probe() returns text language plpgsql as $probe$
declare marker text:='BEGIN in string';
/* BEGIN in comment /* BEGIN nested */ end comment */
begin
 perform 1 from public.local_jobs for update;
 return marker;
end$probe$;

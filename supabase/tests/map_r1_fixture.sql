-- LOCAL/DISPOSABLE POSTGRES ONLY. Synthetic IDs, no production connectivity.
do $$ begin
 if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create table local_jobs(id bigint primary key,company text,location text,active boolean default true,admin_hidden boolean default false);
create table job_work_locations(id bigint primary key,job_id bigint,raw_address text,sort_order int,location_verified boolean default false,lat double precision,lng double precision);
-- Load the real candidate constraints and review RPC, not a permissive imitation.
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values('99999999-9999-9999-9999-999999999999');
create function public.require_admin() returns uuid language sql as $$select '99999999-9999-9999-9999-999999999999'::uuid$$;
create table public.admin_audit_logs(admin_user_id uuid,action text,target_type text,target_id text,metadata jsonb);
\ir ../migrations/20260929120000_job_location_approvals.sql
create table vietmap_usage_daily(day date primary key,calls int default 0,updated_at timestamptz default now());
create function vietmap_usage_take(p_day date,p_limit integer) returns table(ok boolean,used integer) language plpgsql as $$
begin
 insert into vietmap_usage_daily(day,calls)values(p_day,0)on conflict do nothing;
 update vietmap_usage_daily u set calls=u.calls+1 where day=p_day and u.calls<p_limit returning true,u.calls into ok,used;
 if not found then select false,calls into ok,used from vietmap_usage_daily where day=p_day;end if;
 return next;
end $$;
grant select,insert,update on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;

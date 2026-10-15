-- LOCAL/DISPOSABLE POSTGRES ONLY. Synthetic IDs, no production connectivity.
do $$ begin
 if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create table local_jobs(id bigint primary key,company text,location text,active boolean default true,admin_hidden boolean default false,
 title text default 'Factory assembler',description text default 'Assemble manufactured products',category text default 'factory',salary text,
 origin text default 'manual',employer_phone text,contact_zalo text,source_url text,images jsonb);
create table job_work_locations(id bigint primary key,job_id bigint,raw_address text,sort_order int,location_verified boolean default false,lat double precision,lng double precision);
-- Load the real candidate constraints and review RPC, not a permissive imitation.
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values('99999999-9999-9999-9999-999999999999');
create function public.require_admin() returns uuid language sql as $$select '99999999-9999-9999-9999-999999999999'::uuid$$;
create table public.admin_audit_logs(admin_user_id uuid,action text,target_type text,target_id text,metadata jsonb);
create function public.is_admin() returns boolean language sql as $$select false$$;
create extension if not exists unaccent with schema public;
-- Minimal occupation lookup dependency; the R4/R1-R7/R8 trigger bodies are real.
create table public.occupation_master(code text primary key,level smallint);
\ir ../migrations/20261012153000_job_posting_policy_db_enforcement.sql
\ir ../migrations/20261013100000_job_posting_rules.sql
\ir ../migrations/20261015120000_local_jobs_occupation_r8.sql
\ir ../migrations/20260929120000_job_location_approvals.sql
-- Use the actual cache schema, unique key, RLS and shared usage RPC as well.
\ir ../pending/20261008000000_private_research_store.sql
grant select,insert,update on public.local_jobs,public.job_work_locations,
 public.job_location_candidates,public.research_artifacts to service_role;
grant select on public.vietmap_usage_daily,public.occupation_master to service_role;
grant usage on sequence public.job_location_candidates_id_seq,public.research_artifacts_id_seq to service_role;

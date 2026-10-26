-- Synthetic schema for core-contract tests. This is NOT a production schema dump.
create extension if not exists unaccent;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table public.local_jobs(id bigint generated always as identity primary key,company text,location text,active boolean,admin_hidden boolean);
create table public.job_work_locations(id bigint generated always as identity primary key,job_id bigint references public.local_jobs on delete cascade,raw_address text not null,normalized_address text,lat double precision,lng double precision,location_verified boolean not null default false,geocode_status text not null default 'pending',geocode_source text,verification_method text,coordinate_accuracy text,address_accuracy text,sort_order int default 0,updated_at timestamptz default now());
create unique index job_work_locations_job_normaddr_key on public.job_work_locations(job_id,normalized_address);
create table public.job_location_candidates(id bigint generated always as identity primary key,job_id bigint references public.local_jobs on delete cascade,company_snapshot text,address_snapshot text,lat float8,lng float8,place_precision text,status text,reviewed_by uuid,reviewed_at timestamptz);
create table public.admin_confirmed_location_memory(source_candidate_id bigint primary key,address_key text,company_key text,park_key text,lat float8,lng float8,place_precision text,approved_by uuid,approved_at timestamptz,source_address text,active boolean default true);
create table public.map_r1_location_jobs(job_id bigint primary key references public.local_jobs on delete cascade,snapshot jsonb,result jsonb,state text default 'done',updated_at timestamptz default now());
create function public.admin_location_key(p_text text) returns text language sql stable as $$select lower(btrim(regexp_replace(public.unaccent(coalesce(p_text,'')), '[[:space:][:punct:]]+', ' ', 'g')))$$;
alter table public.job_work_locations enable row level security;
grant select on public.local_jobs,public.job_work_locations to service_role;

create table public.job_posting_rules(rule_key text primary key,content text,decided_on date,machine_checkable text,block_mode text,implementation text,last_test_result text);

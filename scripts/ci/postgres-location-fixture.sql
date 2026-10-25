-- Disposable PostgreSQL baseline for location migration. No production connection.
create schema if not exists public;
create extension if not exists unaccent with schema public;
create table public.local_jobs (id bigint primary key, company text, location text);
create table public.job_work_locations (
 id bigint primary key, job_id bigint, raw_address text, industrial_park text,
 location_verified boolean default false, lat float8,lng float8,sort_order integer);
create table public.job_location_candidates (
 id bigint generated always as identity primary key,job_id bigint,work_location_id bigint,
 company_snapshot text,address_snapshot text,lat float8,lng float8,
 place_precision text,source text,evidence text,evidence_urls text[],status text,
 review_note text,reviewed_by uuid,reviewed_at timestamptz,created_by uuid);
create table public.admin_audit_logs (
 id bigint generated always as identity primary key,admin_user_id uuid,
 action text,target_type text,target_id text,metadata jsonb);
create role anon;
create role authenticated;
create role service_role;

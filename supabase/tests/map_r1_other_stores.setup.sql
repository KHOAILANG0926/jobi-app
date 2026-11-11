-- 시험 DB 준비(폐기용, 운영 아님): map_r1_complete가 쓰는 표·함수의 최소 대역. 위치 쓰기 함수는 부른 내용만 기록한다.
create schema if not exists location_private;
create table if not exists public.map_r1_location_jobs (job_id bigint primary key, state text, lease uuid, snapshot jsonb, search_key text, provider_result jsonb, failures int default 0, updated_at timestamptz);
create table if not exists public.map_r1_search_history (job_id bigint, search_key text, result jsonb, failures int default 0, updated_at timestamptz);
create table if not exists location_private.test_writes (job_id bigint, payload jsonb);
create or replace function public.map_r1_snapshot(p_id bigint) returns jsonb language sql as $$ select snapshot from public.map_r1_location_jobs where job_id=p_id $$;
create or replace function location_private.provider_target(s jsonb, r jsonb) returns text language sql as $$ select r->>'address' $$;
create or replace function location_private.write_location(p_job_id bigint, p_operation text, p_payload jsonb) returns bigint language sql as $$
 insert into location_private.test_writes values (p_job_id, p_payload) returning 1::bigint $$;
create or replace function public.admin_location_key(t text) returns text language sql immutable as $$ select lower(btrim(t)) $$;
create or replace function public.admin_reuse_confirmed_location(p_id bigint) returns void language sql as $$ select $$;

-- 시험 DB 준비(폐기용, 운영 아님): map_r1_complete가 쓰는 표·함수의 최소 대역. 위치 쓰기 함수는 부른 내용만 기록한다.
create schema if not exists location_private;
create table if not exists public.map_r1_location_jobs (job_id bigint primary key, state text, lease uuid, snapshot jsonb, search_key text, provider_result jsonb, failures int default 0, calls int default 0, updated_at timestamptz);
create table if not exists public.map_r1_search_history (job_id bigint, search_key text, result jsonb, failures int default 0, calls int default 0, updated_at timestamptz);
create or replace function public.vietmap_usage_take(d date, lim int, out ok boolean) language sql as $$ select true $$;
create table if not exists location_private.test_writes (job_id bigint, payload jsonb);
create or replace function public.map_r1_snapshot(p_id bigint) returns jsonb language sql as $$ select snapshot from public.map_r1_location_jobs where job_id=p_id $$;
create or replace function location_private.provider_target(s jsonb, r jsonb) returns text language sql as $$ select r->>'address' $$;
create or replace function location_private.write_location(p_job_id bigint, p_operation text, p_payload jsonb) returns bigint language sql as $$
 insert into location_private.test_writes values (p_job_id, p_payload) returning 1::bigint $$;

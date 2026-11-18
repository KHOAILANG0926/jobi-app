-- 시험 DB 준비(폐기용): 운영 처리권의 '정확한 핀이면 끝' 줄과 같은 모양의 대역 + 위치 요청 대역.
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
alter table public.local_jobs add column if not exists active boolean not null default true;
alter table public.local_jobs add column if not exists admin_hidden boolean not null default false;
alter table public.job_work_locations add column if not exists point_kind text;
create table if not exists public.map_r1_requests(job_id bigint, force boolean);
create or replace function public.map_r1_has_exact(p_id bigint) returns boolean language sql stable as $$ select exists(select 1 from public.job_work_locations where job_id=p_id and point_kind='exact' and location_verified) $$;
create or replace function public.map_r1_request_location(p_id bigint, p_force boolean default false) returns void language sql as $$ insert into public.map_r1_requests values (p_id, p_force) $$;
create or replace function public.map_r1_claim_job_v2(p_id bigint, p_lease uuid, p_force boolean) returns table(job_id bigint) language plpgsql as $f$
begin
  if public.map_r1_has_exact(p_id) then return; end if;
  return query select p_id;
end $f$;
revoke all on function public.map_r1_claim_job_v2(bigint,uuid,boolean) from public, anon, authenticated;
insert into public.local_jobs(id, company, location) values (990001,'Shop','A'),(990002,'One','B') on conflict (id) do nothing;
insert into public.job_work_locations(id, job_id, raw_address, location_verified, point_kind) values
 (9900011, 990001, 'a1', true, 'exact'), (9900012, 990001, 'a2', false, 'unresolved'),
 (9900021, 990002, 'b1', true, 'exact') on conflict (id) do nothing;

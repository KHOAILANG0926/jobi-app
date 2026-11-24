-- 시험 DB 준비(폐기용): 위치 요청 대역 + 공개/비공개·확정/대략 공고.
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
alter table public.local_jobs add column if not exists active boolean not null default true;
alter table public.local_jobs add column if not exists admin_hidden boolean not null default false;
alter table public.job_work_locations add column if not exists point_authority text;
drop table if exists public.w7_requests;
create table public.w7_requests(job_id bigint, force boolean);
create or replace function public.map_r1_request_location(p_id bigint, p_force boolean default false) returns void language sql as $$ insert into public.w7_requests values (p_id, p_force) $$;
revoke all on function public.map_r1_request_location(bigint, boolean) from public, anon, authenticated;
-- 994001 공개·대략 줄만 / 994002 공개·확정 줄 / 994003 비공개·대략 / 994004 공개·관리자 확정 / 994005 공개·줄 없음 / 994006 숨김·대략
insert into public.local_jobs(id, company, location, active, admin_hidden) values
 (994001,'A','a',true,false),(994002,'B','b',true,false),(994003,'C','c',false,false),(994004,'D','d',true,false),(994005,'E','e',true,false),(994006,'F','f',true,true)
on conflict (id) do nothing;
insert into public.job_work_locations(id, job_id, raw_address, location_verified, point_authority, lat, lng) values
 (9940011,994001,'a',false,'auto_area',21.0,105.8),(9940021,994002,'b',true,'source_verified',21.0,105.8),(9940031,994003,'c',false,'auto_area',21.0,105.8),
 (9940041,994004,'d',false,'admin_confirmed',21.0,105.8),(9940061,994006,'f',false,'auto_area',21.0,105.8)
on conflict (id) do nothing;

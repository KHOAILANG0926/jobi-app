-- 시험 DB 준비(폐기용): 운영 처리권·매시 재시도의 '실패 상한' 줄과 같은 모양의 대역.
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
alter table public.local_jobs add column if not exists admin_hidden boolean not null default false;
drop table if exists public.map_r1_recheck_requests;
create table public.map_r1_recheck_requests(job_id bigint);
drop function if exists public.map_r1_claim_job_v2(bigint,uuid,boolean);
drop function if exists public.map_r1_retry_pending();
drop table if exists public.map_r1_location_jobs cascade;
create table public.map_r1_location_jobs (job_id bigint primary key, state text, lease uuid, snapshot jsonb, search_key text,
 calls int not null default 0, failures int not null default 0, updated_at timestamptz not null default now());
create or replace function public.map_r1_snapshot(p_id bigint) returns jsonb language sql stable as $$ select jsonb_build_object('location', location) from public.local_jobs where id=p_id $$;
create or replace function public.map_r1_has_exact(p_id bigint) returns boolean language sql stable as $$ select false $$;
drop function if exists public.map_r1_request_location(bigint);
create function public.map_r1_request_location(p_id bigint) returns void language sql as $$ insert into public.map_r1_recheck_requests values (p_id) $$;
create function public.map_r1_claim_job_v2(p_id bigint, p_lease uuid, p_force boolean) returns table(job_id bigint) language plpgsql as $f$
declare snap jsonb; r public.map_r1_location_jobs;
begin
  snap:=public.map_r1_snapshot(p_id);
  select * into r from public.map_r1_location_jobs s where s.job_id=p_id for update;
  if found then
    if r.snapshot=snap and r.state='done' and not p_force then return; end if;
    if r.snapshot=snap and r.state='deferred' and r.updated_at > now()-interval '1 hour' then return; end if;
    if r.snapshot=snap and r.state='failed' and not p_force and (r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval '1 hour') then return; end if;
  end if;
  return query select p_id;
end $f$;
revoke all on function public.map_r1_claim_job_v2(bigint,uuid,boolean) from public, anon, authenticated;
create function public.map_r1_retry_pending() returns integer language plpgsql as $f$
declare n integer := 0; j record;
begin
  for j in select l.id from public.local_jobs l left join public.map_r1_location_jobs s on s.job_id = l.id
    where not l.admin_hidden and not public.map_r1_has_exact(l.id) and l.id between 991001 and 991099
      and (s.job_id is null or s.state in ('failed','deferred') or s.snapshot is distinct from public.map_r1_snapshot(l.id))
      and (s.job_id is null or not (s.state = 'failed' and (s.failures >= 2 or s.calls >= 2)) or s.snapshot is distinct from public.map_r1_snapshot(l.id))
    order by l.id desc limit 20
  loop
    perform public.map_r1_request_location(j.id); n := n + 1;
  end loop;
  return n;
end $f$;
revoke all on function public.map_r1_retry_pending() from public, anon, authenticated;
-- 991001 장애 2번·방금 / 991002 장애 2번·이틀 전 / 991003 장애 1번·2시간 전 / 991004 못 찾음(done)·이틀 전 / 991005 호출 2번·이틀 전 / 991006 장애 1번·방금
insert into public.local_jobs(id, company, location) values (991001,'A','a'),(991002,'B','b'),(991003,'C','c'),(991004,'D','d'),(991005,'E','e'),(991006,'F','f') on conflict (id) do nothing;
insert into public.map_r1_location_jobs(job_id,state,snapshot,calls,failures,updated_at) values
 (991001,'failed',jsonb_build_object('location','a'),0,2,now()),
 (991002,'failed',jsonb_build_object('location','b'),0,2,now()-interval '2 days'),
 (991003,'failed',jsonb_build_object('location','c'),0,1,now()-interval '2 hours'),
 (991004,'done',jsonb_build_object('location','d'),0,0,now()-interval '2 days'),
 (991005,'failed',jsonb_build_object('location','e'),2,0,now()-interval '2 days'),
 (991006,'failed',jsonb_build_object('location','f'),0,1,now());

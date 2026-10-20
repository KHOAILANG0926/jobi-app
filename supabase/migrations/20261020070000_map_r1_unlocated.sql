-- 못 찾은 공고 처리 (결정 0006, 2026-10-18 → 2026-10-20 Lee 수정: "삭제하지 말고 해결 방법을 찾아야지… 따로 리스트를 만들어서 저녁에 알람으로")
-- 1) 원문에 위치 정보가 없음(성 이름뿐) → 바로 삭제(map_r1_delete_no_info). 지원·메시지·면접 기록이 있으면 삭제하지 않고 비공개 + 목록.
-- 2) 원문엔 주소가 있는데 우리가 못 찾음 → 비공개(map_r1_unlocated, reason=our_miss). 자동 삭제하지 않는다.
--    매일 03:00(베트남) 고친 코드로 다시 판정(찾으면 다시 공개). 매일 20:00(베트남) 목록을 Lee에게 알림(예약 점검, map_r1_unlocated_report).
-- 3) 동 중심(대략 위치)·공단 입구·확인 좌표 중 하나라도 찾으면 "찾음"(공개 유지). 판정은 api/_lib/auto-location-runtime.mjs + src/lib/locationLevel.ts.
create table if not exists public.map_r1_unlocated (
  job_id bigint primary key references public.local_jobs(id) on delete cascade,
  since timestamptz not null default now(),
  last_checked timestamptz not null default now(),
  prev_active boolean not null default false,
  reason text not null default 'our_miss'
);
alter table public.map_r1_unlocated enable row level security;
revoke all on public.map_r1_unlocated from public, anon, authenticated;
grant select, insert, update, delete on public.map_r1_unlocated to service_role;

create table if not exists public.map_r1_deleted_log (
  job_id bigint not null, title text, reason text not null, since timestamptz, deleted_at timestamptz not null default now()
);
alter table public.map_r1_deleted_log enable row level security;
revoke all on public.map_r1_deleted_log from public, anon, authenticated;
grant select on public.map_r1_deleted_log to service_role;

-- 기존 map_r1_claim_job(2개 인자)은 배포 순서 중 옛 Vercel 코드가 쓰므로 그대로 둔다. 새 코드는 _v2를 쓴다.
create or replace function public.map_r1_claim_job_v2(p_id bigint, p_lease uuid, p_force boolean)
returns table(job_id bigint, snapshot jsonb, calls integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare snap jsonb; input jsonb; key text; h public.map_r1_search_history; r public.map_r1_location_jobs;
begin
  if p_id is null or p_lease is null then raise exception 'invalid claim'; end if;
  if not pg_try_advisory_xact_lock(20261015, 1) then return; end if;
  if not exists(select 1 from public.local_jobs j where j.id = p_id and not j.admin_hidden) then return; end if;
  if public.map_r1_has_exact(p_id) then return; end if;
  if exists(select 1 from public.job_location_candidates c where c.job_id=p_id and c.status in ('rejected','revoked')) then return; end if;
  snap:=public.map_r1_snapshot(p_id);
  input:=public.map_r1_search_input(snap);
  key:=md5(input::text);
  select * into r from public.map_r1_location_jobs s where s.job_id=p_id for update;
  if found then
    if r.state='processing' and r.updated_at > now()-interval '10 minutes' then return; end if;
    -- p_force(못 찾은 공고 재시도): 규칙을 고친 뒤 다시 판정. VietMap 재호출은 공고당 2번 한도·저장 결과 재사용으로 막힌다.
    if r.snapshot=snap and r.state='done' and not p_force then return; end if;
    if r.snapshot=snap and r.state='deferred' and r.updated_at > now()-interval '1 hour' then return; end if;
    if r.snapshot=snap and r.state='failed' and not p_force and (r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval '1 hour') then return; end if;
  end if;
  insert into public.map_r1_search_history(job_id,search_key,search_input) values(p_id,key,input) on conflict do nothing;
  select * into h from public.map_r1_search_history s where s.job_id=p_id and s.search_key=key for update;
  insert into public.map_r1_location_jobs(job_id,snapshot,search_key,state,lease,calls,failures)
  values(p_id,snap,key,'processing',p_lease,h.calls,h.failures)
  on conflict on constraint map_r1_location_jobs_pkey do update
  set snapshot=excluded.snapshot,search_key=excluded.search_key,state='processing',lease=excluded.lease,
      calls=excluded.calls,failures=excluded.failures,updated_at=now(),result=null;
  return query select s.job_id,s.snapshot,s.calls from public.map_r1_location_jobs s where s.job_id=p_id;
end $$;
revoke all on function public.map_r1_claim_job_v2(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.map_r1_claim_job_v2(bigint, uuid, boolean) to service_role;

create or replace function public.map_r1_mark_unlocated(p_id bigint, p_reason text) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare was boolean;
begin
  select active into was from public.local_jobs where id = p_id for update;
  if not found then return; end if;
  insert into public.map_r1_unlocated(job_id, prev_active, reason) values (p_id, coalesce(was, false), coalesce(p_reason, 'our_miss'))
  on conflict (job_id) do update set last_checked = now(), reason = excluded.reason,
    prev_active = public.map_r1_unlocated.prev_active or excluded.prev_active;
  if was then update public.local_jobs set active = false where id = p_id; end if;
end $$;
revoke all on function public.map_r1_mark_unlocated(bigint, text) from public, anon, authenticated;
grant execute on function public.map_r1_mark_unlocated(bigint, text) to service_role;

create or replace function public.map_r1_mark_located(p_id bigint) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.map_r1_unlocated;
begin
  delete from public.map_r1_unlocated where job_id = p_id returning * into r;
  if not found or not r.prev_active then return; end if;
  begin
    update public.local_jobs set active = true where id = p_id and not admin_hidden;
  exception when others then
    return; -- 다른 공개 조건(직업분류 등)에 걸리면 비공개 그대로
  end;
end $$;
revoke all on function public.map_r1_mark_located(bigint) from public, anon, authenticated;
grant execute on function public.map_r1_mark_located(bigint) to service_role;

-- 못 찾은 동안은 공개 금지(관리자가 공개로 바꿔도 비공개 유지)
create or replace function public.map_r1_block_unlocated_publish() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.active and not coalesce(old.active, false) and exists(select 1 from public.map_r1_unlocated u where u.job_id = new.id) then
    update public.map_r1_unlocated set prev_active = true where job_id = new.id;
    new.active := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_map_r1_block_unlocated on public.local_jobs;
create trigger trg_map_r1_block_unlocated before update of active on public.local_jobs
  for each row execute function public.map_r1_block_unlocated_publish();

-- 다시 판정 요청(규칙 보강 반영)
create or replace function public.map_r1_request_location(p_id bigint, p_force boolean) returns void
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare t text;
begin
  select decrypted_secret into t from vault.decrypted_secrets where name = 'map_r1_hook_token' limit 1;
  if t is null or p_id is null then return; end if;
  perform net.http_post(
    url := 'https://www.viecganban.vn/api/location-hook',
    body := jsonb_build_object('job_id', p_id, 'force', p_force),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || t),
    timeout_milliseconds := 60000);
exception when others then
  return;
end $$;
revoke all on function public.map_r1_request_location(bigint, boolean) from public, anon, authenticated;

create or replace function public.map_r1_retry_unlocated() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer := 0; j record;
begin
  for j in select job_id from public.map_r1_unlocated order by last_checked limit 50 loop
    perform public.map_r1_request_location(j.job_id, true); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.map_r1_retry_unlocated() from public, anon, authenticated;
-- 매일 03:00 베트남(= 20:00 UTC) 고친 코드로 다시 판정
select cron.unschedule('map-r1-unlocated-retry') where exists (select 1 from cron.job where jobname = 'map-r1-unlocated-retry');
select cron.schedule('map-r1-unlocated-retry', '0 20 * * *', 'select public.map_r1_retry_unlocated()');

-- 원문에 위치 정보가 없는 공고는 바로 삭제(2026-10-20 Lee "1번은 오케이"). 사용자 기록이 있으면 비공개 + 목록(사용자 데이터 보호).
create or replace function public.map_r1_delete_no_info(p_id bigint) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare t text;
begin
  select title into t from public.local_jobs where id = p_id;
  if not found then return 'missing'; end if;
  if exists(select 1 from public.applications a where a.job_id = p_id)
    or exists(select 1 from public.message_threads m where m.job_id = p_id)
    or exists(select 1 from public.interviews i where i.job_id = p_id) then
    perform public.map_r1_mark_unlocated(p_id, 'no_info_has_user_records');
    return 'kept_hidden';
  end if;
  delete from public.local_jobs where id = p_id;
  insert into public.map_r1_deleted_log(job_id, title, reason, since) values (p_id, t, 'no_location_info', now());
  return 'deleted';
end $$;
revoke all on function public.map_r1_delete_no_info(bigint) from public, anon, authenticated;
grant execute on function public.map_r1_delete_no_info(bigint) to service_role;

-- 예전 계획(14일 뒤 삭제)은 쓰지 않는다
drop function if exists public.map_r1_delete_unlocated();

-- 저녁 8시 보고용 목록(읽기 전용). 못 찾은 공고 + 원문 주소 + VietMap 처리 결과.
create or replace view public.map_r1_unlocated_report with (security_invoker = true) as
select u.job_id, j.title, j.company, j.location, u.reason, u.since, u.last_checked,
       (select array_agg(w.raw_address order by w.sort_order nulls last) from public.job_work_locations w where w.job_id = u.job_id) as addresses,
       s.state as lookup_state, s.result->>'kind' as lookup_kind, s.failures, s.calls
from public.map_r1_unlocated u
join public.local_jobs j on j.id = u.job_id
left join public.map_r1_location_jobs s on s.job_id = u.job_id;
revoke all on public.map_r1_unlocated_report from public, anon, authenticated;
grant select on public.map_r1_unlocated_report to service_role;

-- 이미 있는 공고를 새 규칙(2단계 주소·결정 0006)으로 한 번 다시 판정. 새 Vercel 코드가 배포된 뒤 처리되도록 10분마다 확인하고,
-- 모든 대상이 이 시각 이후 다시 처리되면 스스로 예약을 지운다.
create table if not exists public.map_r1_rejudge_marker (id int primary key default 1, since timestamptz not null default now());
insert into public.map_r1_rejudge_marker(id, since) values (1, now()) on conflict (id) do update set since = now();
revoke all on public.map_r1_rejudge_marker from public, anon, authenticated;

create or replace function public.map_r1_rejudge_once() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer := 0; j record; t timestamptz;
begin
  select since into t from public.map_r1_rejudge_marker where id = 1;
  for j in select l.id from public.local_jobs l left join public.map_r1_location_jobs s on s.job_id = l.id
    where l.active and not l.admin_hidden and not public.map_r1_has_exact(l.id)
      and not exists(select 1 from public.job_location_candidates c where c.job_id = l.id and c.status in ('rejected','revoked'))
      and (s.job_id is null or s.updated_at < t + interval '3 minutes')
      and t > now() - interval '1 day' limit 50
  loop
    perform public.map_r1_request_location(j.id, true); n := n + 1;
  end loop;
  -- 끝났거나 하루가 지나면(무한 반복 방지) 스스로 예약을 지운다
  if n = 0 or t < now() - interval '1 day' then perform cron.unschedule('map-r1-rejudge-once'); end if;
  return n;
end $$;
revoke all on function public.map_r1_rejudge_once() from public, anon, authenticated;
select cron.unschedule('map-r1-rejudge-once') where exists (select 1 from cron.job where jobname = 'map-r1-rejudge-once');
select cron.schedule('map-r1-rejudge-once', '*/10 * * * *', 'select public.map_r1_rejudge_once()');

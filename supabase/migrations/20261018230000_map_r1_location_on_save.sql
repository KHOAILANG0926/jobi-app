-- 공고 저장 즉시 위치 찾기 (Lee 지시 2026-10-18 22:49)
-- - 공고(local_jobs)·근무지(job_work_locations)가 저장·주소 변경되면 Vercel 위치 찾기(api/location-hook)를 바로 부른다(pg_net, 커밋 후 비동기).
-- - VietMap 키는 Vercel 한 곳에만 있다. DB는 키를 모른다. Vercel이 받은 요청이 DB가 보낸 것인지는 아래 출입증(무작위, Vault 보관)으로 확인한다.
-- - 실패·지연분은 DB 예약(pg_cron, 매시)이 다시 부른다. 하루 250번·공고당 2번·같은 주소 재호출 없음 규칙은 그대로(map_r1_reserve_call).
-- - 위치 찾기가 실패해도 공고 저장은 절대 막지 않는다.
create extension if not exists pg_net with schema extensions;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'map_r1_hook_token') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'map_r1_hook_token', 'Vercel api/location-hook 출입증');
  end if;
end $$;

create or replace function public.map_r1_hook_token_ok(p_token text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(length(p_token) >= 32 and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'map_r1_hook_token' limit 1), false)
$$;
revoke all on function public.map_r1_hook_token_ok(text) from public, anon, authenticated;
grant execute on function public.map_r1_hook_token_ok(text) to service_role;

create or replace function public.map_r1_request_location(p_id bigint) returns void
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare t text;
begin
  select decrypted_secret into t from vault.decrypted_secrets where name = 'map_r1_hook_token' limit 1;
  if t is null or p_id is null then return; end if;
  perform net.http_post(
    url := 'https://www.viecganban.vn/api/location-hook',
    body := jsonb_build_object('job_id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || t),
    timeout_milliseconds := 60000);
exception when others then
  return; -- 위치 요청 실패가 공고 저장을 막지 않는다
end $$;
revoke all on function public.map_r1_request_location(bigint) from public, anon, authenticated;

-- 단일 공고 처리권(관리자 일괄 처리 map_r1_claim_batch와 같은 규칙, 대상만 한 건). 공개 전 공고도 처리(위치 확인 후 공개).
create or replace function public.map_r1_claim_job(p_id bigint, p_lease uuid)
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
    if r.snapshot=snap and r.state='done' then return; end if;
    if r.snapshot=snap and r.state='deferred' and r.updated_at > now()-interval '1 hour' then return; end if;
    if r.snapshot=snap and r.state='failed' and (r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval '1 hour') then return; end if;
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
revoke all on function public.map_r1_claim_job(bigint, uuid) from public, anon, authenticated;
grant execute on function public.map_r1_claim_job(bigint, uuid) to service_role;

create or replace function public.map_r1_on_job_saved() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.map_r1_request_location(case when tg_table_name = 'job_work_locations' then new.job_id else new.id end);
  return null;
end $$;
revoke all on function public.map_r1_on_job_saved() from public, anon, authenticated;

drop trigger if exists trg_map_r1_job_saved on public.local_jobs;
create trigger trg_map_r1_job_saved after insert or update of location, company on public.local_jobs
  for each row execute function public.map_r1_on_job_saved();
drop trigger if exists trg_map_r1_work_location_saved on public.job_work_locations;
create trigger trg_map_r1_work_location_saved after insert or update of raw_address on public.job_work_locations
  for each row execute function public.map_r1_on_job_saved();

-- 재시도: 매시 15분, 아직 결과가 없거나(요청 유실) 실패·지연된 공고만 다시 요청(하루·공고당 한도는 위 규칙이 지킴)
create or replace function public.map_r1_retry_pending() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer := 0; j record;
begin
  for j in select l.id from public.local_jobs l left join public.map_r1_location_jobs s on s.job_id = l.id
    where not l.admin_hidden and not public.map_r1_has_exact(l.id)
      and (s.job_id is null or s.state in ('failed','deferred') or s.snapshot is distinct from public.map_r1_snapshot(l.id)
           or (s.state = 'processing' and s.updated_at < now() - interval '10 minutes'))
      and (s.job_id is null or not (s.state = 'failed' and (s.failures >= 2 or s.calls >= 2)) or s.snapshot is distinct from public.map_r1_snapshot(l.id))
    order by l.id desc limit 20
  loop
    perform public.map_r1_request_location(j.id); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.map_r1_retry_pending() from public, anon, authenticated;

select cron.unschedule('map-r1-retry-pending') where exists (select 1 from cron.job where jobname = 'map-r1-retry-pending');
select cron.schedule('map-r1-retry-pending', '15 * * * *', 'select public.map_r1_retry_pending()');

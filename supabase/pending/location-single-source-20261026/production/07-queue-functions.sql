create table public.vietmap_usage_daily(day date primary key,calls integer not null default 0,updated_at timestamptz not null default now());
CREATE OR REPLACE FUNCTION public.map_r1_claim_batch(p_limit integer, p_lease uuid)
 RETURNS TABLE(job_id bigint, snapshot jsonb, calls integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare j record; snap jsonb; input jsonb; key text; h public.map_r1_search_history; r public.map_r1_location_jobs; n integer:=0;
begin
 if p_limit < 1 or p_limit > 20 or p_lease is null then raise exception 'invalid batch'; end if;
 -- Global transaction lock shared by administrator and Actions. Does not rely on workflow concurrency alone.
 if not pg_try_advisory_xact_lock(20261015, 1) then return; end if;
 for j in select id from public.local_jobs where active and not admin_hidden order by id loop
   exit when n>=p_limit;
   if public.map_r1_has_exact(j.id) then continue; end if;
   -- Respect human rejection/revocation. Manual exception remains available.
   if exists(select 1 from public.job_location_candidates c where c.job_id=j.id and c.status in ('rejected','revoked')) then continue; end if;
   snap:=public.map_r1_snapshot(j.id);
   input:=public.map_r1_search_input(snap);
   key:=md5(input::text);
   select * into r from public.map_r1_location_jobs s where s.job_id=j.id for update;
   if found then
     if r.state='processing' and r.updated_at > now()-interval '10 minutes' then continue; end if;
     if r.snapshot=snap and r.state='done' then continue; end if;
     if r.snapshot=snap and r.state='deferred' and r.updated_at > now()-interval '1 hour' then continue; end if;
     if r.snapshot=snap and r.state='failed' and (r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval '1 hour') then continue; end if;
   end if;
   insert into public.map_r1_search_history(job_id,search_key,search_input) values(j.id,key,input) on conflict do nothing;
   select * into h from public.map_r1_search_history s where s.job_id=j.id and s.search_key=key for update;
   -- Even returning to an older address never resets the spent budget/failure history.
   insert into public.map_r1_location_jobs(job_id,snapshot,search_key,state,lease,calls,failures)
   values(j.id,snap,key,'processing',p_lease,h.calls,h.failures)
   on conflict on constraint map_r1_location_jobs_pkey do update
   set snapshot=excluded.snapshot,search_key=excluded.search_key,state='processing',lease=excluded.lease,
       calls=excluded.calls,failures=excluded.failures,updated_at=now(),result=null;
   return query select s.job_id,s.snapshot,s.calls from public.map_r1_location_jobs s where s.job_id=j.id;
   n:=n+1;
 end loop;
end $function$;
CREATE OR REPLACE FUNCTION public.map_r1_claim_job(p_id bigint, p_lease uuid)
 RETURNS TABLE(job_id bigint, snapshot jsonb, calls integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.map_r1_claim_job_v2(p_id bigint, p_lease uuid, p_force boolean)
 RETURNS TABLE(job_id bigint, snapshot jsonb, calls integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.map_r1_reserve_call(p_id bigint, p_lease uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.map_r1_location_jobs; quota record;
begin
 select * into r from public.map_r1_location_jobs where job_id=p_id for update;
 if not found or r.lease is distinct from p_lease or r.state<>'processing' or r.calls>=2
   or r.snapshot is distinct from public.map_r1_snapshot(p_id) then return false; end if;
 select * into quota from public.vietmap_usage_take((now() at time zone 'Asia/Ho_Chi_Minh')::date,250);
 if not quota.ok then return false; end if;
 update public.map_r1_search_history set calls=calls+1,updated_at=now()
 where job_id=p_id and search_key=r.search_key and calls<2;
 if not found then return false; end if;
 update public.map_r1_location_jobs set calls=calls+1,updated_at=now() where job_id=p_id;
 return true;
end $function$;
CREATE OR REPLACE FUNCTION public.map_r1_search_input(p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select jsonb_build_object('location',lower(regexp_replace(btrim(p_snapshot->>'location'),'\s+',' ','g')),
 'addresses',coalesce((select jsonb_agg(a order by a) from
 (select distinct lower(regexp_replace(btrim(t->>'address'),'\s+',' ','g')) a
 from jsonb_array_elements(p_snapshot->'targets') t) x),'[]'::jsonb))
$function$;
CREATE OR REPLACE FUNCTION public.vietmap_usage_take(p_day date, p_limit integer)
 RETURNS TABLE(ok boolean, used integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  insert into public.vietmap_usage_daily(day, calls) values (p_day, 0) on conflict (day) do nothing;
  update public.vietmap_usage_daily u
     set calls = u.calls + 1, updated_at = now()
   where u.day = p_day and u.calls < p_limit
   returning true, u.calls into ok, used;
  if ok is null then
    select false, u.calls into ok, used from public.vietmap_usage_daily u where u.day = p_day;
  end if;
  return next;
end;
$function$;
-- Actual production request helper with only its network/secret dependencies
-- replaced by synthetic in-container stubs that record job IDs, never send HTTP.
create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into vault.decrypted_secrets values('map_r1_hook_token','synthetic-test-only');
create schema net;
create table public.test_hook_requests(id bigint generated always as identity,job_id bigint);
create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint
language plpgsql security definer as $$declare idv bigint;begin
 insert into public.test_hook_requests(job_id) values((body->>'job_id')::bigint) returning id into idv;return idv;
end$$;
CREATE OR REPLACE FUNCTION public.map_r1_request_location(p_id bigint)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare t text;
begin
 select decrypted_secret into t from vault.decrypted_secrets where name = 'map_r1_hook_token' limit 1;
 if t is null or p_id is null then return; end if;
 perform net.http_post(url := 'https://www.viecganban.vn/api/location-hook',body := jsonb_build_object('job_id', p_id),
 headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || t),timeout_milliseconds := 60000);
exception when others then return;
end $function$;

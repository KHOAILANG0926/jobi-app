-- Lee 2026-11-11 "매장이 여러 곳이면 핀이 한 개만 찍힘"(KRIK 2곳, MediaMart 4곳): 위치 찾기 결과의 다른 매장 핀(others)도 기록한다.
-- 다른 매장은 첫 매장과 같은 방법으로 찾은 것만 온다(번지·공단 정문·Google 회사 장소, src/lib/autoLocationResolver.ts otherStorePoints).
-- Lee 2026-11-11 절대 원칙 "지도 위치를 모르면 마음대로 찍지 마": 찾지 못한 매장은 결과에 없고, 여기서도 핀이 빈 근무지 줄에만 쓴다(이미 좌표가 있는 줄은 덮지 않음).
begin;
create or replace function public.map_r1_complete(p_id bigint,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.map_r1_location_jobs;k text;addr text;wid bigint;latv float8;lngv float8;o jsonb;oaddr text;owid bigint;n int:=0;begin
 perform 1 from public.local_jobs where id=p_id for update;
 perform 1 from public.job_work_locations where job_id=p_id order by id for update;
 select * into r from public.map_r1_location_jobs where job_id=p_id for update;
 if not found or p_lease is null or r.lease is distinct from p_lease or r.state<>'processing' then return false;end if;
 if r.snapshot is distinct from public.map_r1_snapshot(p_id) then
  update public.map_r1_location_jobs set state='failed',failures=failures+1,lease=null,updated_at=now() where job_id=p_id;
  return false;
 end if;
 k:=p_result->>'kind';
 if k is null or k not in ('exact','gate','area','unresolved') then raise exception 'invalid result';end if;
 if k<>'unresolved' then
  latv:=(p_result->>'lat')::float8;lngv:=(p_result->>'lng')::float8;
  if latv is null or lngv is null or not(latv between 8 and 24 and lngv between 102 and 110)
   or nullif(btrim(p_result->>'source'),'') is null or nullif(btrim(p_result->>'checkedAt'),'') is null then raise exception 'missing provenance';end if;
  addr:=location_private.provider_target(r.snapshot,p_result);wid:=(p_result->>'workLocationId')::bigint;
  if addr is null or not(addr=r.snapshot->>'location' or exists(select 1 from jsonb_array_elements(r.snapshot->'targets') t where t->>'address'=addr))
   or (wid is not null and not exists(select 1 from public.job_work_locations where id=wid and job_id=p_id and raw_address=addr)) then raise exception 'stale result target';end if;
  if k='exact' and (nullif(btrim(r.snapshot->>'company'),'') is null or nullif(btrim(p_result->>'evidence'),'') is null) then raise exception 'invalid exact evidence';end if;
  if not exists(select 1 from public.job_location_candidates where job_id=p_id and status in ('rejected','revoked')
    and public.admin_location_key(address_snapshot)=public.admin_location_key(addr)) then
   perform location_private.write_location(p_id,'upsert',jsonb_build_object('address',addr,'lat',latv,'lng',lngv,
    'authority',case k when 'exact' then 'source_verified' when 'gate' then 'auto_gate' else 'auto_area' end,'evidence',p_result));
   perform public.admin_reuse_confirmed_location(p_id);
  end if;
 end if;
 -- 다른 매장 핀(Lee 2026-11-11 KRIK·MediaMart): 대략 위치(area)만, 이 공고 근무지 줄 주소여야 하고 첫 핀 주소와 달라야 한다. 최대 4곳.
 -- 같은 위치 쓰기 함수(write_location)·같은 거부 목록 검사. 형식이 틀린 항목은 건너뛴다(첫 핀 기록은 그대로).
 for o in select value from jsonb_array_elements(case when jsonb_typeof(p_result->'others')='array' then p_result->'others' else '[]'::jsonb end) loop
  exit when n>=4;
  continue when o->>'kind' is null or o->>'kind' not in ('exact','gate','area');
  begin latv:=(o->>'lat')::float8;lngv:=(o->>'lng')::float8; exception when others then continue; end;
  continue when latv is null or lngv is null or not(latv between 8 and 24 and lngv between 102 and 110)
   or nullif(btrim(o->>'source'),'') is null or nullif(btrim(o->>'checkedAt'),'') is null;
  oaddr:=nullif(btrim(o->>'address'),'');
  continue when oaddr is null or oaddr is not distinct from addr
   or not exists(select 1 from jsonb_array_elements(r.snapshot->'targets') t where t->>'address'=oaddr);
  owid:=case when o->>'workLocationId' ~ '^[0-9]+$' then (o->>'workLocationId')::bigint end;
  continue when o->>'kind'='exact' and nullif(btrim(o->>'evidence'),'') is null;
  continue when owid is not null and not exists(select 1 from public.job_work_locations where id=owid and job_id=p_id and raw_address=oaddr);
  -- 이미 핀이 있는 근무지 줄(사이트 수집 좌표·관리자 확정 등)은 덮어쓰지 않는다 — 비어 있는 매장만 채운다.
  continue when exists(select 1 from public.job_work_locations where job_id=p_id and lat is not null
    and public.admin_location_key(raw_address)=public.admin_location_key(oaddr));
  continue when exists(select 1 from public.job_location_candidates where job_id=p_id and status in ('rejected','revoked')
    and public.admin_location_key(address_snapshot)=public.admin_location_key(oaddr));
  perform location_private.write_location(p_id,'upsert',jsonb_build_object('address',oaddr,'lat',latv,'lng',lngv,
   'authority',case o->>'kind' when 'exact' then 'source_verified' when 'gate' then 'auto_gate' else 'auto_area' end,'evidence',o));
  n:=n+1;
 end loop;
 update public.map_r1_search_history set result=p_result,failures=failures+case when coalesce((p_result->>'failed')::boolean,false) then 1 else 0 end,updated_at=now()
 where job_id=p_id and search_key=r.search_key;
 update public.map_r1_location_jobs set provider_result=p_result,
 state=case when coalesce((p_result->>'deferred')::boolean,false) then 'deferred' when coalesce((p_result->>'failed')::boolean,false) then 'failed' else 'done' end,
 failures=failures+case when coalesce((p_result->>'failed')::boolean,false) then 1 else 0 end,lease=null,updated_at=now() where job_id=p_id;
 return true;
end$$;
revoke all on function public.map_r1_complete(bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.map_r1_complete(bigint,uuid,jsonb) to service_role;
-- VietMap 예약: 공고당 2번 → 매장(근무지)마다 2번(최대 5곳). 하루 한도(vietmap_usage_take 250)·같은 검색 재호출 없음은 그대로.
CREATE OR REPLACE FUNCTION public.map_r1_reserve_call(p_id bigint, p_lease uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.map_r1_location_jobs; quota record; cap int;
begin
 select * into r from public.map_r1_location_jobs where job_id=p_id for update;
 cap:=2*greatest(1,least(5,coalesce(jsonb_array_length(case when jsonb_typeof(r.snapshot->'targets')='array' then r.snapshot->'targets' end),1)));
 if not found or r.lease is distinct from p_lease or r.state<>'processing' or r.calls>=cap
   or r.snapshot is distinct from public.map_r1_snapshot(p_id) then return false; end if;
 select * into quota from public.vietmap_usage_take((now() at time zone 'Asia/Ho_Chi_Minh')::date,250);
 if not quota.ok then return false; end if;
 update public.map_r1_search_history set calls=calls+1,updated_at=now()
 where job_id=p_id and search_key=r.search_key and calls<cap;
 if not found then return false; end if;
 update public.map_r1_location_jobs set calls=calls+1,updated_at=now() where job_id=p_id;
 return true;
end $function$;

commit;

begin;
-- Lee 2026-10-29 "바꾸고 앱에 올려": 성/시 대략 핀은 원문(source_text)에 그 성/시 이름이 있을 때만.
-- 원인(#5063): Facebook 수집기가 그룹 지역(예: Bắc Ninh)을 location에 채웠고, 20261028050507 대략 핀이 그 칸을
-- 원문 근거처럼 썼다. 원문이 없는 공고(관리자 직접 입력)는 지금과 같다. 시 이름이 원문에 없고 성 이름만 있으면 성으로.
-- 핀이 없어진 공고는 location_verified=false라 관리자 위치 확정 목록에 그대로 남는다. 공고 공개/비공개는 바꾸지 않는다.
create function location_private.area_in_text(p_area jsonb, p_text text) returns boolean
language sql stable set search_path=pg_catalog as $fn$
 select exists(select 1 from jsonb_array_elements_text(coalesce(p_area->'aliases','[]'::jsonb)) alias
  where ' '||public.admin_location_key(p_text)||' ' like '% '||alias||' %')
$fn$;
revoke all on function location_private.area_in_text(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function location_private.area_in_text(jsonb,text) to location_writer;
do $patch$
declare migration_role text:=current_user;
 original_set boolean:=pg_has_role(current_user,'location_writer','SET');
 original_memberships jsonb:=(select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=current_user::regrole);
 original_create boolean:=has_schema_privilege('location_writer','location_private','CREATE');
 definition text; anchor text := $a$
  if r is not null then
   latv:=(r->>'lat')::float8;lngv:=(r->>'lng')::float8;$a$; replacement text;
begin
 if not original_set then execute format('grant location_writer to %I with inherit false, set true',migration_role);end if;
 if not original_create then grant create on schema location_private to location_writer;end if;
 select pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure) into definition;
 if position('location_private.area_in_text' in definition)>0 then raise exception 'area source-text rule already present';end if;
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'administrative area fallback anchor changed';end if;
 replacement := $r$
  if r is not null and nullif(btrim(j.source_text),'') is not null and not location_private.area_in_text(r,j.source_text) then
   r:=case when r ? 'parentKey' then location_private.administrative_area(replace(r->>'parentKey','province:','')) end;
   if r is not null and not location_private.area_in_text(r,j.source_text) then r:=null;end if;
  end if;$r$ || anchor;
 execute 'set local role location_writer';
 execute replace(definition,anchor,replacement);
 execute format('set local role %I',migration_role);
 if not original_create then revoke create on schema location_private from location_writer;end if;
 if not original_set then execute format('revoke location_writer from %I',migration_role);end if;
 if has_schema_privilege('location_writer','location_private','CREATE') is distinct from original_create
 or (select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=migration_role::regrole) is distinct from original_memberships then raise exception 'temporary writer permissions not restored';end if;
end$patch$;
-- 지금 있는 자동 대략 핀(사람 확정·원문 확인 핀 제외)을 같은 writer로 다시 판정. 공고 번호 고정 없음.
do $backfill$
declare item record; changed int:=0; before_kind text;
begin
 for item in select w.job_id,w.raw_address,w.point_kind from public.job_work_locations w join public.local_jobs j on j.id=w.job_id
  where w.point_authority='auto_area' and not w.location_verified order by w.job_id,w.id
 loop
  perform location_private.write_location(item.job_id,'upsert',jsonb_build_object('address',item.raw_address,'authority','unresolved'));
  select point_kind into before_kind from public.job_work_locations where job_id=item.job_id and raw_address is not distinct from item.raw_address order by id limit 1;
  if before_kind is distinct from item.point_kind then changed:=changed+1; raise notice 'area pin re-judged: job % % -> %',item.job_id,item.point_kind,before_kind;end if;
 end loop;
 raise notice 'area pins changed: %',changed;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'canonical location integrity after area source-text rule';end if;
end$backfill$;
commit;

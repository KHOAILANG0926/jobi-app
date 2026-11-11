-- 시험 DB 준비(폐기용, 운영 아님): 운영 write_location의 성·시 중심 단계 모양만 가진 대역(역할·소유자 포함).
do $$begin if not exists(select 1 from pg_roles where rolname='location_writer') then create role location_writer nologin; end if; end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
create schema if not exists location_private;
create or replace function location_private.administrative_area(p_address text) returns jsonb language sql as $$ select '{"lat":21.0,"lng":106.0,"key":"province:bac ninh"}'::jsonb $$;
create or replace function location_private.write_location(p_job_id bigint,p_operation text,p_payload jsonb) returns bigint language plpgsql as $f$
declare kind text:='unresolved'; r jsonb; latv float8; addr text:=p_payload->>'address'; w record;
begin
 select null::bigint as id into w;
 -- A missing point is an approximate administrative area until admin review.
 if kind='unresolved' and p_operation='upsert' then
  r:=location_private.administrative_area(addr);
  if r is not null then latv:=(r->>'lat')::float8; kind:='area'; end if;
 end if;
 if w.id is null then
  return case when kind='area' then 1 else 0 end;
 end if;
 return 0;
end $f$;
alter function location_private.write_location(bigint,text,jsonb) owner to location_writer;
revoke all on function location_private.write_location(bigint,text,jsonb) from public;

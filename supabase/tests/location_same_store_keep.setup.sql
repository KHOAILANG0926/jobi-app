-- 시험 DB 준비(폐기용, 운영 아님): 운영 write_location의 '기존 줄 찾기 → 확정 줄 보호 → 줄 갱신' 모양만 가진 대역(역할·소유자 포함).
do $$begin if not exists(select 1 from pg_roles where rolname='location_writer') then create role location_writer nologin; end if; end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
create schema if not exists location_private;
alter table public.job_work_locations add column if not exists point_authority text;
alter table public.job_work_locations add column if not exists normalized_address text;
create or replace function location_private.write_location(p_job_id bigint,p_operation text,p_payload jsonb) returns bigint language plpgsql as $f$
declare w public.job_work_locations; addr text:=nullif(btrim(coalesce(p_payload->>'raw_address',p_payload->>'address')),''); lockkey bigint;
begin
 select * into w from public.job_work_locations where job_id=p_job_id
 and public.admin_location_key(raw_address)=public.admin_location_key(addr) order by sort_order,id limit 1 for update;
 if p_payload ? 'work_location_id' and w.id is distinct from (p_payload->>'work_location_id')::bigint then raise exception 'stale target'; end if;
 if w.id is null then
  insert into public.job_work_locations(id,job_id,raw_address,sort_order) values((select coalesce(max(id),0)+1 from public.job_work_locations),p_job_id,addr,0) returning * into w;
 end if;
 update public.job_work_locations set raw_address=addr where id=w.id;
 return w.id;
end $f$;
alter function location_private.write_location(bigint,text,jsonb) owner to location_writer;
revoke all on function location_private.write_location(bigint,text,jsonb) from public;
grant usage on schema location_private to location_writer;
grant select,insert,update on public.job_work_locations to location_writer;
grant execute on function public.admin_location_key(text) to location_writer;
grant execute on function public.unaccent(text) to location_writer;
insert into public.local_jobs(id,company,location) values (990101,'Shop','x'),(990102,'Shop','y'),(990103,'Shop','z') on conflict (id) do nothing;
insert into public.job_work_locations(id,job_id,raw_address,location_verified,point_authority,lat,lng,sort_order) values
 (9901011,990101,'152 Trần Hưng Đạo, TP. Bắc Ninh, Bắc Ninh',true,'admin_confirmed',21.18,106.07,0),
 (9901021,990102,'Số 1 Lê Lợi, Hà Nội',false,null,null,null,0),
 (9901031,990103,'12 Nguyễn Trãi, Hà Nội',true,'auto_reuse',21.0,105.8,0),
 (9901032,990103,'12 Nguyễn Trãi, Hà Nội, Việt Nam',true,'auto_reuse',21.0,105.8,1)
on conflict (id) do nothing;

-- Read-only post-migration assertion. Geometry/main/detail checks are performed
-- separately by scripts/ops/location-administrative-public-check.mjs through
-- normal anonymous REST and actual rendered public maps.
do $$begin
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'canonical location integrity mismatch';end if;
 -- 2026-11-11 Lee 지도 위치 절대 원칙: 위치를 모르는 공고에 성·시 중심 핀을 찍지 않으므로 '공개 공고는 핀이 꼭 있어야 한다' 검사는 지웠다
 -- (20261111200000_no_administrative_area_pin). 핀 없는 공개 공고는 관리자 위치 확정·Lee 결정 대상.
 if exists(select 1 from public.job_work_locations w where w.point_evidence ? 'administrativeAreaKey'
 and (w.point_authority<>'auto_area' or w.point_kind<>'area' or w.location_verified)) then raise exception 'administrative approximation promoted to verified workplace';end if;
 if has_schema_privilege('location_writer','location_private','CREATE') then raise exception 'temporary writer schema CREATE not restored';end if;
 if exists(select 1 from pg_auth_members m where roleid='location_writer'::regrole and (inherit_option or set_option)) then raise exception 'unsafe writer membership';end if;
 if exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
 and (has_schema_privilege(r.rolname,'location_private','USAGE')
 or has_function_privilege(r.rolname,'location_private.administrative_area(text)','EXECUTE')
 or has_function_privilege(r.rolname,'location_private.write_location(bigint,text,jsonb)','EXECUTE'))) then raise exception 'private fallback/write access exposed';end if;
end$$;
select count(*) as public_jobs_without_verified_coordinates
from public.local_jobs j where j.active=true and not j.admin_hidden
and not exists(select 1 from public.job_work_locations w where w.job_id=j.id and w.location_verified);

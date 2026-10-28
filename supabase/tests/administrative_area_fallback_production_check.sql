-- Read-only post-migration assertion. Geometry/main/detail checks are performed
-- separately by scripts/ops/location-administrative-public-check.mjs through
-- normal anonymous REST and actual rendered public maps.
do $$begin
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'canonical location integrity mismatch';end if;
 if exists(select 1 from public.local_jobs j where j.active=true and not j.admin_hidden
 and not exists(select 1 from public.job_work_locations w where w.job_id=j.id and w.point_kind<>'unresolved' and w.lat is not null and w.lng is not null))
 then raise exception 'public job has no canonical pin; resolve original administrative evidence before completing rollout';end if;
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

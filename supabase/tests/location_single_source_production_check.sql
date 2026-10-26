-- Read-only deployment verification. No posting IDs or expected publication counts.
-- Execute after the canonical migration through the normal migrations workflow.
do $$declare r text;writer oid;trusted_owner oid;begin
 if to_regprocedure('public.location_integrity_issues()') is null then
  raise exception 'Canonical location integrity RPC is missing';end if;
 if exists(select 1 from public.location_integrity_issues()) then
  raise exception 'Canonical location integrity check failed: %',
   (select jsonb_object_agg(issue,n) from (select issue,count(*) n from public.location_integrity_issues() group by issue) issues);
 end if;
 select oid into writer from pg_roles where rolname='location_writer';
 if writer is null or exists(select 1 from pg_roles where oid=writer and
  (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)) then
  raise exception 'Canonical writer role is missing or unsafe';end if;
 select nspowner into trusted_owner from pg_namespace where nspname='location_private';
 if exists(select 1 from pg_auth_members where roleid=writer and
  not(member=trusted_owner and admin_option and not inherit_option and not set_option)) then
  raise exception 'Canonical writer has unsafe membership';end if;
 for r in select unnest(array['anon','authenticated','service_role']) loop
  if pg_has_role(r,'location_writer','MEMBER') or has_schema_privilege(r,'location_private','USAGE')
   or has_function_privilege(r,'location_private.write_location(bigint,text,jsonb)','EXECUTE')
   or has_table_privilege(r,'public.job_work_locations','INSERT,UPDATE,DELETE,TRUNCATE') then
   raise exception 'Application role % has canonical write/private access',r;end if;
  if exists(select 1 from information_schema.column_privileges where table_schema='public'
   and table_name='job_work_locations' and grantee=r and privilege_type in ('INSERT','UPDATE')) then
   raise exception 'Application role % has canonical column write grant',r;end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='public.job_work_locations'::regclass
  and tgname='trg_00_location_single_writer' and tgenabled='O') then raise exception 'Canonical source guard missing/disabled';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.map_r1_location_jobs'::regclass
  and tgname='trg_location_derived_cache' and tgenabled='O') then raise exception 'Canonical derived cache guard missing/disabled';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where ((n.nspname='location_private' and c.relkind='r') or (n.nspname='public' and c.relname in
  ('job_work_locations','map_r1_location_jobs','job_location_candidates','admin_confirmed_location_memory')))
  and not c.relrowsecurity) then raise exception 'Canonical relation RLS disabled';end if;
end$$;
select count(*) filter(where issue='confirmed_memory_differs_from_source') as memory_source_mismatches,
 count(*) filter(where issue='stale_confirmation_on_source') as stale_confirmation_sources,
 count(*) filter(where issue='map_cache_differs_from_source') as source_cache_mismatches,
 count(*) filter(where issue='invalid_source_point') as invalid_source_points,
 count(*) as total_location_integrity_issues
from public.location_integrity_issues();

-- Read-only public point evidence for the final report. Targets are enumerated,
-- never selected by a posting number. No approval/provider private payloads.
select j.id as job_id,
 coalesce((select jsonb_agg(jsonb_build_object('workLocationId',w.id,'lat',w.lat,'lng',w.lng,
   'kind',w.point_kind,'precision',w.point_precision,'revision',w.point_revision) order by w.sort_order,w.id)
   from public.job_work_locations w where w.job_id=j.id and w.point_kind<>'unresolved'),'[]'::jsonb) as source_points,
 coalesce(c.source_points,'[]'::jsonb) as cached_points
from public.local_jobs j left join public.map_r1_location_jobs c on c.job_id=j.id
where j.active and not j.admin_hidden order by j.id;

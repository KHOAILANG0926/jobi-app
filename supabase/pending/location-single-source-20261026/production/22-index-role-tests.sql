-- Actual DML caller regression: superuser-only seed inserts missed this failure.
\set ON_ERROR_STOP on
begin;
set local role service_role;
insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
values('index role regression','Index role company','Index role address','admin',false,true)
returning id as service_job \gset
update public.local_jobs set company='Updated index role company' where id=:service_job;
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
values(:service_job,'Updated index role company','Index role address',21.1,106.1,'building','company_official','Local index permission test') returning id as candidate \gset
update public.job_location_candidates set company_snapshot='Another index role company' where id=:candidate;
reset role;
-- Test-only DML policy models an authorized employer without bypassing RLS.
grant insert,update on public.local_jobs to authenticated;
grant usage,select on sequence public.local_jobs_id_seq to authenticated;
create policy index_role_fixture_insert on public.local_jobs for insert to authenticated with check(company='Authenticated index role company' and not active and admin_hidden);
set local role authenticated;
insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
values('authenticated index regression','Authenticated index role company','Local address','employer',false,true);
reset role;
do $$declare r text;begin
 for r in select unnest(array['authenticated','service_role']) loop
  if not has_function_privilege(r,'location_private.company_identity(text)','EXECUTE') then raise exception 'Missing index helper execute: %',r;end if;
 end loop;
 for r in select unnest(array['anon','authenticated','service_role']) loop
  if has_schema_privilege(r,'location_private','USAGE')
   or has_function_privilege(r,'location_private.write_location(bigint,text,jsonb)','EXECUTE')
   or has_table_privilege(r,'public.job_work_locations','INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Source protection opened: %',r;end if;
 end loop;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'Index DML damaged canonical integrity';end if;
end$$;
rollback;
\echo 'PASS: service-role job/candidate INSERT+UPDATE and authorized authenticated INSERT; source/private writer protections retained'

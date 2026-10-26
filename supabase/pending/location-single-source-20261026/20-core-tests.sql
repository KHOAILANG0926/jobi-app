\set ON_ERROR_STOP on
-- Run only in a disposable database; job IDs always come from RETURNING.
create or replace function pg_temp.assert_ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
select pg_temp.assert_ok(to_regprocedure('location_private.write_location(bigint,text,double precision,double precision,text,jsonb)') is not null,'single canonical writer exists');
insert into public.local_jobs(company,location,active,admin_hidden) values
 ('Fixture A','Exact address A',true,false) returning id as first_job \gset
insert into public.local_jobs(company,location,active,admin_hidden) values
 ('Fixture A','Exact address A',false,true) returning id as same_job \gset
insert into public.local_jobs(company,location,active,admin_hidden) values
 ('Fixture B','Exact address A',true,false) returning id as other_company \gset
insert into public.local_jobs(company,location,active,admin_hidden) values ('Fixture A','Exact address A',false,true) returning id as no_work_job \gset
select location_private.write_location(:first_job,'Exact address A',null,null,'unresolved','{}');
select location_private.write_location(:same_job,'Exact address A',null,null,'unresolved','{}');
select location_private.write_location(:other_company,'Exact address A',null,null,'unresolved','{}');
insert into public.local_jobs(company,location,active,admin_hidden) values ('Fíxture A','Exact address A',false,true) returning id as accent_company \gset
select location_private.write_location(:accent_company,'Exact address A',null,null,'unresolved','{}');
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,status,reviewed_by,reviewed_at)
values(:first_job,'Fixture A','Exact address A',21.1959873,106.0087454,'building','approved','00000000-0000-4000-8000-000000000001',now()) returning id as candidate_id \gset
insert into public.admin_confirmed_location_memory(source_candidate_id,address_key,company_key,lat,lng,place_precision,approved_by,approved_at,source_address)
select c.id,public.admin_location_key(c.address_snapshot),public.admin_location_key(c.company_snapshot),c.lat,c.lng,c.place_precision,c.reviewed_by,c.reviewed_at,c.address_snapshot
from public.job_location_candidates c where c.id=:candidate_id;
select pg_temp.assert_ok((select count(*)=2 from public.job_work_locations where job_id in (:first_job,:same_job) and lat=21.1959873 and lng=106.0087454 and location_verified),'confirmation and same company/address fanout');
select pg_temp.assert_ok((select lat is null from public.job_work_locations where job_id=:other_company),'different company must not inherit approval');
select pg_temp.assert_ok((select lat is null from public.job_work_locations where job_id=:accent_company),'company diacritics must not be collapsed');
select pg_temp.assert_ok((select lat=21.1959873 and location_verified from public.job_work_locations where job_id=:no_work_job),'missing workplace is created from actual job address');
select pg_temp.assert_ok((select count(*)=2 from public.map_r1_location_jobs where job_id in (:first_job,:same_job) and (source_points->0->>'lat')::float8=21.1959873),'cache trigger sees canonical point');
select pg_temp.assert_ok(not exists(select 1 from public.location_integrity_issues()),'all invariants hold');
select point_revision as confirmation_revision from public.job_work_locations where job_id=:first_job \gset
select location_private.reconcile_memory();
select pg_temp.assert_ok((select point_revision=:confirmation_revision from public.job_work_locations where job_id=:first_job),'repeating the same confirmation does not churn cache/audit');
-- Stale approval can be hidden when the cache still matches the old source.
update public.local_jobs set company='Renamed fixture' where id=:first_job;
select pg_temp.assert_ok(exists(select 1 from public.location_integrity_issues() where issue='stale_confirmation_on_source' and job_id=:same_job),'reverse monitor catches obsolete approval even when cache matches source');
update public.local_jobs set company='Fixture A' where id=:first_job;
-- Direct database writes must fail even with a spoofed custom setting.
grant update(lat) on public.job_work_locations to service_role;
set role service_role;
set app.location_writer = 'on';
do $$begin
 begin update public.job_work_locations set lat=22; raise exception 'direct write escaped';
 exception when insufficient_privilege then
  if sqlerrm <> 'location source: use the canonical writer' then raise; end if;
 end;
 begin perform location_private.write_location(null::bigint,'forged',22,106,'admin_confirmed','{}'); raise exception 'private writer escaped';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
revoke update(lat) on public.job_work_locations from service_role;
-- Simulate a missing original row inside this disposable DB, then detect it.
set role location_writer;
delete from public.job_work_locations where job_id=:no_work_job;
reset role;
select pg_temp.assert_ok(exists(select 1 from public.location_integrity_issues() where issue='confirmed_memory_differs_from_source' and job_id=:no_work_job),'monitor catches missing original row');
select location_private.reconcile_memory();
-- A late provider response cannot undo a human approval.
select location_private.write_location(:first_job,'Exact address A',21.1,105.9,'auto_area','{"source":"provider","checkedAt":"2026-10-01T00:00:00Z"}');
select pg_temp.assert_ok((select lat=21.1959873 from public.job_work_locations where job_id=:first_job),'late auto response preserves human decision');
-- Poster-owned pins cannot replace an administrator's confirmation either.
select location_private.write_location(:first_job,'Exact address A',21.2,106.2,'poster_pin','{"source":"poster_pin","checkedAt":"2026-10-26T01:00:00Z"}');
select pg_temp.assert_ok((select lat=21.1959873 and point_candidate_id=:candidate_id from public.job_work_locations where job_id=:first_job),'poster pin cannot replace admin decision');
-- A stale queue/cache write cannot change the derived map point.
update public.map_r1_location_jobs set result='{"kind":"area","lat":22,"lng":105}' where job_id=:first_job;
select pg_temp.assert_ok((select (result->>'lat')::float8=21.1959873 from public.map_r1_location_jobs where job_id=:first_job),'cache is a projection, not a write path');
-- Revocation clears original + every derived point and reused copy.
update public.job_location_candidates set status='revoked' where id=:candidate_id;
select pg_temp.assert_ok(exists(select 1 from public.location_integrity_issues() where issue='stale_confirmation_on_source' and job_id=:first_job),'revoked approval is detected before source/cache are cleared');
update public.admin_confirmed_location_memory set active=false where source_candidate_id=:candidate_id;
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id in (:first_job,:same_job,:no_work_job) and lat is not null),'revocation removes all reused points');
select pg_temp.assert_ok(not exists(select 1 from public.map_r1_location_jobs where job_id in (:first_job,:same_job,:no_work_job) and source_points<>'[]'::jsonb),'revocation clears cache');
-- Multiple workplaces stay separate; cache must carry the entire set.
select location_private.write_location(:first_job,'Second address',21.2,106.1,'auto_area','{"source":"provider","checkedAt":"2026-10-01T00:00:00Z"}');
select location_private.write_location(:first_job,'Third address',21.3,106.2,'auto_gate','{"source":"provider","checkedAt":"2026-10-01T00:00:00Z"}');
select pg_temp.assert_ok((select jsonb_array_length(source_points)=2 from public.map_r1_location_jobs where job_id=:first_job),'multiple workplace point set preserved');
select pg_temp.assert_ok(not exists(select 1 from public.location_integrity_issues()),'no mismatch after revocation and multiple sites');
select 'PASS: canonical writer / fanout / isolation / priority / cache / revocation / multiple sites' as result;

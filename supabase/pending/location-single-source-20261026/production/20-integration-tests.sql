\set ON_ERROR_STOP on
create function pg_temp.assert_ok(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.expect_error(statement text,expected_state text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then
  if sqlstate=expected_state then return;end if;raise;
 end;raise exception 'Expected SQLSTATE % from %',expected_state,statement;
end$$;
select pg_temp.assert_ok(public.location_gate_fixture_probe()='BEGIN in string','gate lexer preserves literals/comments and real entry');
insert into auth.users(id) values(gen_random_uuid()) returning id as admin_user \gset
select set_config('request.jwt.claim.sub',:'admin_user',false);
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',false);
insert into public.local_jobs(title,company,location,origin,active,admin_hidden,guest_manage_token)
 values('private fixture','Company Á','Address A','crawler',false,true,'test-guest-management-token-long') returning id as first_job \gset
insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
 values('private fixture','Company Á','Address A','crawler',false,true) returning id as same_job \gset
insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
 values('private fixture','Company A','Address A','crawler',false,true) returning id as accent_job \gset
insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
 values('private fixture','Company B','Address A','crawler',false,true) returning id as other_job \gset
select public.replace_job_work_locations(:first_job,'[{"raw_address":"Address A","industrial_park":"Existing park"},{"raw_address":"Secondary site","sort_order":1}]');
select public.replace_job_work_locations(:same_job,'[{"raw_address":"Address A"}]');
select public.replace_job_work_locations(:accent_job,'[{"raw_address":"Address A"}]');
select public.replace_job_work_locations(:other_job,'[{"raw_address":"Address A"}]');
select pg_temp.assert_ok((select count(*)=1 from public.test_hook_requests where job_id=:first_job),'new unresolved batch requests provider once');
select id as first_work from public.job_work_locations where job_id=:first_job and raw_address='Address A' \gset
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(:first_job,'Company Á','Address A',21.1,106.1,'building','company_official','Official address and entrance match') returning id as first_candidate \gset
set role authenticated;
select public.admin_review_location_candidate(:first_candidate,'approve','integration proof');
reset role;
select pg_temp.assert_ok((select count(*)=2 from public.job_work_locations where job_id in (:first_job,:same_job) and lat=21.1 and point_kind='exact' and point_precision='building'),'human approval and strict fanout');
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id in (:accent_job,:other_job) and lat is not null),'different company and diacritics isolated');
select pg_temp.assert_ok((select st_x(geog::geometry)=106.1 and st_y(geog::geometry)=21.1 from public.job_work_locations where id=:first_work),'real PostGIS generated geography');
select pg_temp.assert_ok(not exists(select 1 from public.location_integrity_issues()),'initial source/cache agreement');
-- Existing source row ID and exact evidence survive a crawler metadata batch.
select count(*) as previous_hook_requests from public.test_hook_requests \gset
select point_revision as old_revision from public.job_work_locations where id=:first_work \gset
select public.replace_job_work_locations(:first_job,'[{"raw_address":"Address A","industrial_park":"Updated park"},{"raw_address":"Secondary site","sort_order":1}]');
select pg_temp.assert_ok((select id=:first_work and lat=21.1 and point_revision=:old_revision and industrial_park='Updated park' from public.job_work_locations where job_id=:first_job and raw_address='Address A'),'metadata batch preserves human point and row ID');
select pg_temp.assert_ok((select count(*)=:previous_hook_requests from public.test_hook_requests),'same-address metadata/human writes do not request provider');
-- Owner authorization and human protection, including guest token.
set role anon;
select public.set_job_pinned_location(:first_job,'test-guest-management-token-long','Address A',22,105);
reset role;
select pg_temp.assert_ok((select lat=21.1 from public.job_work_locations where id=:first_work),'owner cannot replace human approval');
select pg_temp.expect_error(format('select public.set_job_pinned_location(%s,%L,%L,22,105)',:first_job,'invalid','Address A'),'42501');
-- Test actual SQL roles: direct table access, private calls, GUC spoofing.
set role service_role;
set app.location_writer='on';
select pg_temp.expect_error(format('update public.job_work_locations set lat=22 where id=%s',:first_work),'42501');
select pg_temp.expect_error(format('delete from public.job_work_locations where id=%s',:first_work),'42501');
select pg_temp.expect_error(format('insert into public.job_work_locations(job_id,raw_address) values(%s,%L)',:first_job,'Spoof'),'42501');
select pg_temp.expect_error(format('select location_private.write_location(%s,%L,%L::jsonb)',:first_job,'upsert','{}'),'42501');
reset role;
-- An accidentally restored column grant is still stopped by the execution-role guard.
grant update(lat) on public.job_work_locations to service_role;
set role service_role;
select pg_temp.expect_error(format('update public.job_work_locations set lat=22 where id=%s',:first_work),'42501');
reset role;
revoke update(lat) on public.job_work_locations from service_role;
-- Multi-site canonical set and queue state preservation during point updates.
update public.map_r1_location_jobs set state='processing',lease=gen_random_uuid(),calls=1,failures=1 where job_id=:first_job returning lease as test_lease \gset
select location_private.write_location(:first_job,'upsert',jsonb_build_object('address','Secondary site','authority','auto_gate','lat',21.2,'lng',106.2,'evidence',jsonb_build_object('source','OpenStreetMap way/fixture','checkedAt',now())));
select pg_temp.assert_ok((select jsonb_array_length(source_points)=2 and state='processing' and lease=:'test_lease'::uuid and calls=1 and failures=1 from public.map_r1_location_jobs where job_id=:first_job),'whole set cache preserves in-flight lease/budget');
update public.map_r1_location_jobs set snapshot=public.map_r1_snapshot(job_id) where job_id=:first_job;
set role service_role;
select public.map_r1_complete(:first_job,:'test_lease',jsonb_build_object('kind','area','address','Address A','lat',22,'lng',105,'source','VietMap opaque_private_identifier','checkedAt',now()));
reset role;
select pg_temp.assert_ok((select lat=21.1 and point_kind='exact' from public.job_work_locations where id=:first_work),'late auto completion preserves human');
select pg_temp.assert_ok((select provider_result->>'kind'='area' and result->>'kind'='exact' and source_points->0->>'source'='admin_approved' from public.map_r1_location_jobs where job_id=:first_job),'provider response separate from derived display');
select pg_temp.assert_ok(not public.map_r1_complete(:first_job,:'test_lease','{"kind":"unresolved"}'),'stale lease rejected');
-- Missing evidence and a bad second batch row roll back the complete operation.
select pg_temp.expect_error(format('select location_private.write_location(%s,%L,%L::jsonb)',:other_job,'upsert','{"address":"Address A","authority":"auto_area","lat":21,"lng":106}'),'P0001');
select pg_temp.expect_error(format('select public.replace_job_work_locations(%s,%L::jsonb)',:other_job,'[{"raw_address":"Would be new"},{"raw_address":"Bad","lat":90,"lng":106,"geocode_source":"source"}]'),'P0001');
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id=:other_job and raw_address='Would be new'),'failed batch leaves no partial source');
-- Latest human decision wins; old approval replays are rejected, not applied.
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(:same_job,'Company Á','Address A',21.3,106.3,'site','company_official','Newer official confirmation') returning id as newer_candidate \gset
select public.admin_review_location_candidate(:newer_candidate,'approve','newest');
select pg_temp.assert_ok((select count(*)=2 from public.job_work_locations where job_id in (:first_job,:same_job) and lat=21.3),'latest global human approval wins');
select pg_temp.expect_error(format('select location_private.write_location(%s,%L,%L::jsonb)',:first_job,'upsert',jsonb_build_object('address','Address A','authority','auto_reuse','memory_id',:first_candidate)::text),'P0001');
-- Source deletion/revocation cancels reused descendants and their cache.
select public.admin_review_location_candidate(:newer_candidate,'revoke','withdraw newest');
select pg_temp.assert_ok((select lat=21.1 from public.job_work_locations where id=:first_work),'revoking latest restores still-valid older human');
select public.admin_review_location_candidate(:first_candidate,'revoke','withdraw source');
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id in (:first_job,:same_job) and raw_address='Address A' and lat is not null),'revoke clears all copied coordinates');
-- Parent A→B used to leave A available to self-validate. Preserve secondary site.
select public.admin_review_location_candidate(:first_candidate,'approve','restore');
update public.local_jobs set location='Address B' where id=:first_job;
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id in (:first_job,:same_job) and point_candidate_id=:first_candidate),'parent address change invalidates origin and descendants');
select pg_temp.assert_ok((select raw_address='Address B' and lat is null from public.job_work_locations where id=:first_work),'parent row remapped retaining ID');
select pg_temp.assert_ok(exists(select 1 from public.job_work_locations where job_id=:first_job and raw_address='Secondary site' and lat=21.2),'explicit secondary site preserved');
-- Empty parent address retires matching primary source and retains history.
update public.local_jobs set location=null where id=:first_job;
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where id=:first_work),'empty parent source retired');
select pg_temp.assert_ok(exists(select 1 from location_private.retained_rows where row_data->>'id'=:first_work::text and reason='writer_delete'),'retired source retained privately');
-- Memory's source key cannot be moved across companies.
select pg_temp.expect_error(format('update public.admin_confirmed_location_memory set source_candidate_id=%s where source_candidate_id=%s',:first_candidate+10000,:first_candidate),'P0001');
-- Hidden jobs are absent from canonical public RPC, irrespective of RLS bypass.
set role anon;
select pg_temp.assert_ok(not exists(select 1 from public.map_r1_public_points(array[:first_job,:same_job])),'hidden RPC points remain private');
reset role;
update public.local_jobs set active=true,admin_hidden=false where id=:first_job;
select pg_temp.assert_ok((select jsonb_array_length(source_points)=1 and result->'points'=source_points from public.map_r1_public_points(array[:first_job])),'public RPC includes full canonical set');
-- Cache rows and revision mismatches have an independent source oracle.
delete from public.map_r1_location_jobs where job_id=:first_job;
select pg_temp.assert_ok(exists(select 1 from public.location_integrity_issues() where issue='map_cache_differs_from_source' and job_id=:first_job),'missing public cache detected');
select location_private.write_location(:first_job,'upsert',jsonb_build_object('address','Secondary site','authority','auto_gate','lat',21.2,'lng',106.2,'evidence',jsonb_build_object('source','OpenStreetMap way/fixture','checkedAt',now())));
select pg_temp.assert_ok(not exists(select 1 from public.location_integrity_issues()),'final integrity clean');
-- FK cascade still works through the guarded table and invalidates approval copies.
delete from public.local_jobs where id=:same_job;
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id=:same_job),'parent FK cascade preserved');
select 'PASS: real scoped schema/RLS/PostGIS, adapters, guards, rollback, latest approval, invalidation, privacy, full point sets' result;

-- Adding a new owner source address must immediately reuse a valid matching memory.
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(:other_job,'Company B','Address A',21.6,106.6,'site','company_official','New owner reuse evidence') returning id as pin_memory_candidate \gset
select public.admin_review_location_candidate(:pin_memory_candidate,'approve','owner reuse');
insert into public.local_jobs(title,company,location,origin,active,admin_hidden,guest_manage_token)
 values('private owner fixture','Company B','Different original address','employer',false,true,'test-new-owner-management-token') returning id as new_owner_job \gset
select public.set_job_pinned_location(:new_owner_job,'test-new-owner-management-token','Address A',22,105);
select pg_temp.assert_ok(exists(select 1 from public.job_work_locations where job_id=:new_owner_job and raw_address='Address A' and lat=21.6 and point_candidate_id=:pin_memory_candidate),'new poster source uses existing same-address human memory');
-- Deleting an approved source candidate invalidates all descendants transactionally.
delete from public.job_location_candidates where id=:pin_memory_candidate;
select pg_temp.assert_ok(not exists(select 1 from public.job_work_locations where job_id in (:other_job,:new_owner_job) and lat is not null),'candidate deletion clears source and reused copies');
-- Stale snapshots fail the lease without accepting provider coordinates.
update public.map_r1_location_jobs set state='processing',snapshot='{}',lease=gen_random_uuid() where job_id=:other_job returning lease as stale_snapshot_lease \gset
select pg_temp.assert_ok(not public.map_r1_complete(:other_job,:'stale_snapshot_lease','{"kind":"area","address":"Address A","lat":22,"lng":105,"source":"provider","checkedAt":"2026-10-01T00:00:00Z"}'),'stale snapshot rejected');
select pg_temp.assert_ok(not exists(select 1 from public.location_integrity_issues()),'extended invalidation integrity clean');
select 'PASS: new poster source memory reuse, approved candidate deletion, stale snapshot' result;

\set ON_ERROR_STOP on
begin;
insert into local_jobs(id,company,location)values(1,'Fixture','12 Test Street'),(2,'Fixture 2','Test area'),(3,'Verified','Existing address');
insert into job_work_locations values(30,3,'Existing address',0,true,21,106);
set local role service_role;
do $$
declare token uuid:='11111111-1111-1111-1111-111111111111'; n int; accepted boolean; out jsonb;
begin
 select count(*) into n from map_r1_claim_batch(10,token);
 if n<>2 then raise exception 'expected two unresolved jobs, got %',n;end if;
 select count(*) into n from map_r1_claim_batch(10,'22222222-2222-2222-2222-222222222222');
 if n<>0 then raise exception 'concurrent lease stole work';end if;
 if not map_r1_reserve_call(1,token) or not map_r1_reserve_call(1,token) or map_r1_reserve_call(1,token) then raise exception 'two-call cap';end if;
 if map_r1_reserve_call(2,'22222222-2222-2222-2222-222222222222') then raise exception 'wrong lease reserved';end if;
 out:='{"kind":"exact","lat":21,"lng":106,"source":"VietMap fixture","checkedAt":"2026-10-15","address":"12 Test Street","workLocationId":null,"evidence":"synthetic exact evidence"}';
 if not map_r1_complete(1,token,out) then raise exception 'exact save';end if;
 if map_r1_complete(1,token,out) then raise exception 'replay wrote again';end if;
 select count(*) into n from job_location_candidates where job_id=1;
 if n<>1 then raise exception 'duplicate exact candidates';end if;
 if not map_r1_complete(2,token,'{"kind":"area","lat":21.1,"lng":106.1,"source":"VietMap fixture-area","checkedAt":"2026-10-15"}') then raise exception 'area save';end if;
 select count(*) into n from map_r1_public_points(array[1,2,3]::bigint[]);
 if n<>1 then raise exception 'only representative exposed';end if;
 select count(*) into n from map_r1_claim_batch(10,token);
 if n<>0 then raise exception 'completed jobs retried';end if;
 if exists(select 1 from local_jobs where not active or admin_hidden) then raise exception 'publication changed';end if;
 if has_table_privilege('anon','map_r1_location_jobs','select') or has_function_privilege('authenticated','map_r1_complete(bigint,uuid,jsonb)','execute') then raise exception 'private data exposed';end if;
end $$;
reset role;
update local_jobs set location='changed address' where id=2;
set local role service_role;
do $$declare n int;begin
 select count(*) into n from map_r1_public_points(array[2]::bigint[]);if n<>0 then raise exception 'stale representative visible';end if;
end $$;
reset role;
rollback;
select 'MAP-R1 SQL: leases, cap, replay, precision, publication, RLS and stale snapshot passed' as result;

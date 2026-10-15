\set ON_ERROR_STOP on
begin;
insert into local_jobs(id,company,location) values(101,'Fixture','Address A');
set local role service_role;
do $$
declare t uuid:='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; n int; c int;
begin
 perform * from map_r1_claim_batch(10,t);
 if not map_r1_reserve_call(101,t) or not map_r1_reserve_call(101,t) or map_r1_reserve_call(101,t) then raise exception 'original address cap'; end if;
 perform map_r1_complete(101,t,'{"kind":"unresolved"}');
 update local_jobs set location='Address B' where id=101;
 select calls into c from map_r1_claim_batch(10,t) where job_id=101;
 if c is distinct from 0 then raise exception 'new address must have fresh budget, got %',c;end if;
 if not map_r1_reserve_call(101,t) or not map_r1_reserve_call(101,t) or map_r1_reserve_call(101,t) then raise exception 'new address cap';end if;
 perform map_r1_complete(101,t,'{"kind":"unresolved"}');
 update local_jobs set location='Address A' where id=101;
 perform * from map_r1_claim_batch(10,t);
 if map_r1_reserve_call(101,t) then raise exception 'return to old address reset budget';end if;
 select count(*) into n from map_r1_search_history where job_id=101 and calls=2;
 if n<>2 then raise exception 'old history lost';end if;
end $$;
-- Same address, different company / regenerated workplace IDs must retain the budget.
update local_jobs set company='Renamed',location='  ADDRESS A  ' where id=101;
do $$declare t uuid:='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; c int;begin
 update map_r1_location_jobs set updated_at=now()-interval '11 minutes' where job_id=101;
 perform * from map_r1_claim_batch(10,t);
 if map_r1_reserve_call(101,t) then raise exception 'company/case/space change replenished calls';end if;
end $$;
insert into job_work_locations(id,job_id,raw_address,sort_order) values(1010,101,'  ADDRESS A ',1),(1011,101,'Address B',0);
do $$declare t uuid:='dddddddd-dddd-dddd-dddd-dddddddddddd'; n int;begin
 update map_r1_location_jobs set updated_at=now()-interval '11 minutes' where job_id=101;
 perform * from map_r1_claim_batch(10,t);
 if not map_r1_reserve_call(101,t) then raise exception 'new workplace set budget unavailable';end if;
 perform map_r1_complete(101,t,'{"kind":"unresolved"}');
 update job_work_locations set id=id+2,sort_order=1-sort_order where job_id=101;
 perform * from map_r1_claim_batch(10,t);
 if not map_r1_reserve_call(101,t) or map_r1_reserve_call(101,t) then raise exception 'workplace row IDs/order replenished budget';end if;
 select count(*) into n from map_r1_search_history where job_id=101;
 if n<>3 then raise exception 'workplace identity created extra history';end if;
end $$;
reset role;
insert into local_jobs(id,company,location) values
 (102,'Fixture','Exact address'),(103,'Fixture','Rejected address'),(104,'Fixture','Revoked address'),
 (105,'Fixture','Pending address'),(106,'New company','Old approval address'),(107,'Fixture','Invalid address'),(108,'Fixture','Stale address');
insert into job_work_locations(id,job_id,raw_address,sort_order) values(1070,107,'Invalid address',0),(9990,108,'Stale address',0);
set local role service_role;
do $$
declare t uuid:='cccccccc-cccc-cccc-cccc-cccccccccccc'; out jsonb; cid bigint; n int; blocked boolean:=false;
begin
 perform * from map_r1_claim_batch(20,t);
 -- Admin approvals/rejections/revocations committed after claim must win at completion.
 insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(102,'Fixture','Exact address',21,106,'building','map_listing','original evidence') returning id into cid;
 execute 'set local role authenticated';
 perform admin_review_location_candidate(cid,'approve','human approval');
 execute 'set local role service_role';
 out:='{"kind":"exact","lat":21.01,"lng":106.01,"source":"VietMap fixture","checkedAt":"2026-10-15","address":"Exact address","workLocationId":null,"evidence":"synthetic checked evidence"}';
 if map_r1_complete(102,t,out) then raise exception 'overrode existing approval';end if;
 if not exists(select 1 from job_location_candidates where id=cid and status='approved' and lat=21 and evidence='original evidence') then raise exception 'human approval changed';end if;
 insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(103,'Fixture','Rejected address',21,106,'building','map_listing','human rejection') returning id into cid;
 execute 'set local role authenticated';
 perform admin_review_location_candidate(cid,'reject','do not approve');
 execute 'set local role service_role';
 if map_r1_complete(103,t,jsonb_set(out,'{address}','"Rejected address"')) then raise exception 'reapproved rejected';end if;
 insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(104,'Fixture','Revoked address',21,106,'site','map_listing','human revocation') returning id into cid;
 execute 'set local role authenticated';
 perform admin_review_location_candidate(cid,'approve','first approval');
 execute 'set local role service_role';
 execute 'set local role authenticated';
 perform admin_review_location_candidate(cid,'revoke','withdrawn');
 execute 'set local role service_role';
 if map_r1_complete(104,t,jsonb_set(out,'{address}','"Revoked address"')) then raise exception 'reapproved revoked';end if;
 -- Nearby pending area evidence/coordinates must not be rewritten into an approved site.
 insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(105,'Fixture','Pending address',21.01001,106.01001,'area','original_post','pending area') returning id into cid;
 if not map_r1_complete(105,t,jsonb_set(out,'{address}','"Pending address"')) then raise exception 'new verified candidate failed';end if;
 if not exists(select 1 from job_location_candidates where id=cid and status='pending' and place_precision='area' and evidence='pending area' and lat=21.01001) then raise exception 'pending candidate overwritten';end if;
 if not exists(select 1 from job_location_candidates where job_id=105 and status='approved' and lat=21.01 and lng=106.01) then raise exception 'saved other than validated coordinates';end if;
 insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence,status)
 values(106,'Old company','Old approval address',21,106,'building','map_listing','old approval','approved');
 if map_r1_complete(106,t,jsonb_set(out,'{address}','"Old approval address"')) then raise exception 'silently bypassed stale approval';end if;
 if (select result from map_r1_location_jobs where job_id=106) is not null then raise exception 'false exact success stored';end if;
 begin
   perform map_r1_complete(107,t,out||'{"address":"Invalid address","workLocationId":9990}');
 exception when raise_exception then
   if sqlerrm <> 'invalid exact evidence' then raise; end if;
   blocked:=true;end;
 if not blocked then raise exception 'cross-job workplace accepted';end if;
 -- Address edited while a worker runs: no reservation/completion against the stale snapshot.
 update local_jobs set location='Changed while running' where id=108;
 if map_r1_reserve_call(108,t) or map_r1_complete(108,t,out||'{"address":"Stale address","workLocationId":9990}') then raise exception 'stale worker accepted';end if;
 if exists(select 1 from local_jobs where not active or admin_hidden) then raise exception 'publication changed';end if;
 if has_table_privilege('anon','map_r1_search_history','select') or has_table_privilege('authenticated','map_r1_search_history','select') then raise exception 'search history leaked';end if;
end $$;
reset role;
rollback;
select 'MAP-R1 review: address history/cap, real approval/rejection/revocation rules, stale/conflicting candidates and publication passed' as result;

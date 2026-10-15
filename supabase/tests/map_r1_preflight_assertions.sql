\set ON_ERROR_STOP on
-- Disposable fixture DB only; never run this file on production.
begin;
insert into local_jobs(id,company,location) values(301,'Budget fixture','Address');
insert into vietmap_usage_daily(day,calls) values((now() at time zone 'Asia/Ho_Chi_Minh')::date,249)
 on conflict(day) do update set calls=249;
set local role service_role;
do $$declare t uuid:='ffffffff-ffff-ffff-ffff-ffffffffffff'; n int;begin
 perform * from map_r1_claim_batch(10,t);
 if not map_r1_reserve_call(301,t) then raise exception '250th reservation refused';end if;
 if map_r1_reserve_call(301,t) then raise exception '251st reservation accepted';end if;
 select calls into n from vietmap_usage_daily where day=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 if n<>250 then raise exception 'shared usage exceeds cap: %',n;end if;
 select calls into n from map_r1_search_history where job_id=301;
 if n<>1 then raise exception 'refused daily quota consumed address budget';end if;
 insert into research_artifacts(kind,name,payload) values('map-r1-query','synthetic','{"data":[]}')
 on conflict(kind,name) do update set payload=excluded.payload;
 insert into research_artifacts(kind,name,payload) values('map-r1-query','synthetic','{"data":[1]}')
 on conflict(kind,name) do update set payload=excluded.payload;
 if (select count(*) from research_artifacts where kind='map-r1-query' and name='synthetic')<>1 then raise exception 'cache unique key';end if;
 if has_function_privilege('anon','vietmap_usage_take(date,integer)','execute') then raise exception 'quota RPC exposed';end if;
 if has_table_privilege('authenticated','research_artifacts','select') then raise exception 'cache exposed';end if;
end $$;
reset role;
do $$declare blocked boolean:=false; n int;begin
 select count(*) into n from pg_trigger where tgrelid='local_jobs'::regclass and not tgisinternal
 and tgname in ('trg_enforce_job_posting_policy','trg_zz_enforce_job_posting_rules','trg_zzz_local_jobs_occupation_r8');
 if n<>3 then raise exception 'existing publication triggers missing';end if;
 begin
  insert into local_jobs(id,company,title,description)values(302,'Fixture','Debt collector','Debt collection duties');
 exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'existing excluded-role guard stopped working';end if;
 blocked:=false;
 begin
  insert into local_jobs(id,company,origin)values(303,'Fixture','admin');
 exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'existing source-evidence guard stopped working';end if;
 blocked:=false;
 begin
  insert into local_jobs(id,company,occupation_evidence)values(304,'Fixture','orphan evidence');
 exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'existing R8 guard stopped working';end if;
end $$;
rollback;
select 'MAP-R1 preflight: real shared daily quota/cache schema and existing R4/R1-R7/R8 triggers passed' as result;

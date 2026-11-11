-- 시험 DB 확인(폐기용): 첫 핀 + 다른 매장 대략 위치 핀이 같은 쓰기 함수로 기록되고, 틀린 항목은 건너뛴다.
insert into public.local_jobs(id,company,location) values (9001,'KRIK','152 Trần Hưng Đạo, Bắc Ninh');
insert into public.job_work_locations(id,job_id,raw_address,sort_order) values (1,9001,'152 Trần Hưng Đạo, Bắc Ninh',0),(2,9001,'148 Trần Phú, Từ Sơn, Bắc Ninh',1);
insert into public.map_r1_location_jobs(job_id,state,lease,snapshot,search_key) values (9001,'processing','00000000-0000-0000-0000-000000000001',
 '{"company":"KRIK","location":"152 Trần Hưng Đạo, Bắc Ninh","targets":[{"address":"152 Trần Hưng Đạo, Bắc Ninh","workLocationId":1},{"address":"148 Trần Phú, Từ Sơn, Bắc Ninh","workLocationId":2}]}','k');
do $$declare ok boolean;n int;begin
 ok:=public.map_r1_complete(9001,'00000000-0000-0000-0000-000000000001',
  '{"kind":"area","lat":21.18,"lng":106.07,"source":"Google x (company)","checkedAt":"2026-11-11","address":"152 Trần Hưng Đạo, Bắc Ninh","workLocationId":1,
    "others":[{"kind":"area","lat":21.12,"lng":105.96,"source":"VietMap ward cache x","checkedAt":"2026-11-11","address":"148 Trần Phú, Từ Sơn, Bắc Ninh","workLocationId":2},
              {"kind":"exact","lat":21.1,"lng":105.9,"source":"x","checkedAt":"x","address":"148 Trần Phú, Từ Sơn, Bắc Ninh"},
              {"kind":"area","lat":21.1,"lng":105.9,"source":"x","checkedAt":"x","address":"không có trong tin"},
              {"kind":"area","lat":50,"lng":10,"source":"x","checkedAt":"x","address":"148 Trần Phú, Từ Sơn, Bắc Ninh"}]}');
 if not ok then raise exception 'complete returned false';end if;
 select count(*) into n from location_private.test_writes where job_id=9001;
 if n<>2 then raise exception 'expected main + one other store write, got %',n;end if;
 if not exists(select 1 from location_private.test_writes where payload->>'address'='148 Trần Phú, Từ Sơn, Bắc Ninh' and payload->>'authority'='auto_area') then
  raise exception 'other store not written as auto_area';end if;
 if (select state from public.map_r1_location_jobs where job_id=9001)<>'done' then raise exception 'job not done';end if;
end$$;
-- 다른 매장이 없는 결과는 예전과 같다(쓰기 1번)
insert into public.local_jobs(id,company,location) values (9002,'A','1 Lý Thái Tổ, Bắc Ninh');
insert into public.job_work_locations(id,job_id,raw_address,sort_order) values (3,9002,'1 Lý Thái Tổ, Bắc Ninh',0);
insert into public.map_r1_location_jobs(job_id,state,lease,snapshot,search_key) values (9002,'processing','00000000-0000-0000-0000-000000000002',
 '{"company":"A","location":"1 Lý Thái Tổ, Bắc Ninh","targets":[{"address":"1 Lý Thái Tổ, Bắc Ninh","workLocationId":3}]}','k');
do $$begin
 perform public.map_r1_complete(9002,'00000000-0000-0000-0000-000000000002','{"kind":"area","lat":21.18,"lng":106.07,"source":"s","checkedAt":"c","address":"1 Lý Thái Tổ, Bắc Ninh","workLocationId":3}');
 if (select count(*) from location_private.test_writes where job_id=9002)<>1 then raise exception 'single-store result changed';end if;
end$$;
-- 이미 좌표가 있는 다른 매장 줄은 덮어쓰지 않는다
insert into public.local_jobs(id,company,location) values (9003,'B','1 A, Bắc Ninh');
insert into public.job_work_locations(id,job_id,raw_address,sort_order,lat,lng) values (4,9003,'1 A, Bắc Ninh',0,null,null),(5,9003,'2 B, Bắc Ninh',1,21.2,106.0);
insert into public.map_r1_location_jobs(job_id,state,lease,snapshot,search_key) values (9003,'processing','00000000-0000-0000-0000-000000000003',
 '{"company":"B","location":"1 A, Bắc Ninh","targets":[{"address":"1 A, Bắc Ninh","workLocationId":4},{"address":"2 B, Bắc Ninh","workLocationId":5}]}','k');
do $$begin
 perform public.map_r1_complete(9003,'00000000-0000-0000-0000-000000000003','{"kind":"area","lat":21.18,"lng":106.07,"source":"s","checkedAt":"c","address":"1 A, Bắc Ninh","workLocationId":4,
  "others":[{"kind":"area","lat":21.1,"lng":105.9,"source":"s","checkedAt":"c","address":"2 B, Bắc Ninh","workLocationId":5}]}');
 if (select count(*) from location_private.test_writes where job_id=9003)<>1 then raise exception 'existing pinned store must not be overwritten';end if;
end$$;
-- VietMap 예약: 매장 2곳이면 4번까지(공고당 2번 묶음 아님)
insert into public.map_r1_search_history(job_id,search_key,calls) values (9001,'k',0);
update public.map_r1_location_jobs set state='processing',lease='00000000-0000-0000-0000-0000000000a1',calls=0 where job_id=9001;
do $$declare n int:=0;i int;begin
 for i in 1..6 loop if public.map_r1_reserve_call(9001,'00000000-0000-0000-0000-0000000000a1') then n:=n+1; end if; end loop;
 if n<>4 then raise exception 'two stores should allow 4 VietMap calls, got %',n;end if;
end$$;

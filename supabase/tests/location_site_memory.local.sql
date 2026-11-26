-- 20261126090000 시험(폐기용 DB): 같은 회사 + 같은 사업장 확정 좌표만 기억으로 나오고, 다른 지점·다른 회사·대략 위치는 나오지 않는다.
begin;
insert into public.local_jobs(id, company, location, active) values
 (993001, 'Công ty TNHH Hojeong Vina', 'Lô C3, KCN Quế Võ, Bắc Ninh', false),
 (993002, 'Công ty TNHH Hojeong Vina', 'Lô D5, KCN Quế Võ, Bắc Ninh', false),
 (993004, 'Công ty TNHH Delta', 'KCN Yên Phong, Bắc Ninh', false);
-- 위치 원본은 쓰기 함수로만(운영과 같은 길). Google 확정 줄 2개(다른 로트) + 대략 위치(미확정) 줄 1개.
select location_private.write_location(993001,'upsert','{"address":"Lô C3, KCN Quế Võ, Bắc Ninh","province":"Bắc Ninh","lat":21.15,"lng":106.15,"authority":"source_verified","evidence":{"source":"Google ChIJabc (company)","checkedAt":"2026-11-20T00:00:00Z","evidence":"same name one place"}}');
select location_private.write_location(993002,'upsert','{"address":"Lô D5, KCN Quế Võ, Bắc Ninh","province":"Bắc Ninh","lat":21.16,"lng":106.16,"authority":"source_verified","evidence":{"source":"Google ChIJdef (company)","checkedAt":"2026-11-20T00:00:00Z","evidence":"same name one place"}}');
select location_private.write_location(993004,'upsert','{"address":"KCN Yên Phong, Bắc Ninh","province":"Bắc Ninh","lat":21.20,"lng":106.00,"authority":"auto_area","evidence":{"source":"VietMap area","checkedAt":"2026-11-20T00:00:00Z","evidence":"area"}}');
do $t$ declare n int; s text;
begin
 -- 1) 성조·띄어쓰기·쉼표만 다른 같은 주소 → 기억 1곳(Google 출처 그대로)
 select count(*), min(source) into n, s from public.location_site_memory('Công ty TNHH Hojeong Vina', 'lô c3  KCN Que Vo Bac Ninh');
 if n <> 1 or s <> 'Google' then raise exception '1: accent/space variant must match (got %, %)', n, s; end if;
 -- 2) 뒤에 지역 이름만 붙음 → 같은 사업장
 select count(*) into n from public.location_site_memory('Công ty TNHH Hojeong Vina', 'Lô C3, KCN Quế Võ, Bắc Ninh, Việt Nam');
 if n <> 1 then raise exception '2: region-only tail must match (got %)', n; end if;
 -- 3) 회사 이름 표기만 다름(대소문자·띄어쓰기) → 같은 회사
 select count(*) into n from public.location_site_memory('CÔNG TY TNHH  HOJEONG VINA', 'Lô C3, KCN Quế Võ, Bắc Ninh');
 if n <> 1 then raise exception '3: company spelling variant must match (got %)', n; end if;
 -- 4) 같은 회사 다른 로트 → 그 로트 줄만(C3 좌표가 섞이지 않음)
 select count(*) into n from public.location_site_memory('Công ty TNHH Hojeong Vina', 'Lô D5, KCN Quế Võ, Bắc Ninh');
 if n <> 1 or not exists(select 1 from public.location_site_memory('Công ty TNHH Hojeong Vina', 'Lô D5, KCN Quế Võ, Bắc Ninh') where lat = 21.16) then raise exception '4: other lot must not reuse C3 (got %)', n; end if;
 -- 5) 공단 이름만(로트 없음) → 어느 로트와도 같은 사업장 아님
 select count(*) into n from public.location_site_memory('Công ty TNHH Hojeong Vina', 'KCN Quế Võ, Bắc Ninh');
 if n <> 0 then raise exception '5: park name alone must not match (got %)', n; end if;
 -- 6) 다른 회사 같은 주소 → 없음
 select count(*) into n from public.location_site_memory('Công ty TNHH Gamma', 'Lô C3, KCN Quế Võ, Bắc Ninh');
 if n <> 0 then raise exception '6: other company must not match (got %)', n; end if;
 -- 7) 관리자 확정 줄 → 출처 admin_approved
 select min(source) into s from public.location_site_memory('Công ty TNHH Sao Mai', 'Số 9 Lý Thái Tổ, Bắc Ninh');
 if s is distinct from 'admin_approved' then raise exception '7: admin confirmed source must be admin_approved (got %)', s; end if;
 -- 8) 번지가 다름(9 vs 19) → 없음
 select count(*) into n from public.location_site_memory('Công ty TNHH Sao Mai', 'Số 19 Lý Thái Tổ, Bắc Ninh');
 if n <> 0 then raise exception '8: different house number must not match (got %)', n; end if;
 -- 9) 대략 위치(미확정) 줄 → 기억으로 쓰지 않음
 select count(*) into n from public.location_site_memory('Công ty TNHH Delta', 'KCN Yên Phong, Bắc Ninh');
 if n <> 0 then raise exception '9: gate/unverified row must not be memory (got %)', n; end if;
 -- 10) 빈 회사·빈 주소 → 없음
 select count(*) into n from public.location_site_memory('', 'Lô C3, KCN Quế Võ, Bắc Ninh');
 if n <> 0 then raise exception '10: empty company'; end if;
 select count(*) into n from public.location_site_memory('Công ty TNHH Hojeong Vina', '  ');
 if n <> 0 then raise exception '10: empty address'; end if;
end$t$;
rollback;

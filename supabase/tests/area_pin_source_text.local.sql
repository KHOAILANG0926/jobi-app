-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 20261029120000 적용 뒤 실행. 공고 번호 고정 없음.
-- 성/시 대략 핀은 원문(source_text)에 그 이름이 있을 때만(Lee 2026-10-29, #5063 원인: 수집기가 채운 그룹 지역).
\set ON_ERROR_STOP 1
set client_min_messages = warning;
begin;
do $$
declare a bigint; b bigint; c bigint; k text;
begin
 a := public.ingest_job(jsonb_build_object('channel','sql_file','title','Tuyển nhân viên','company','Fixture Area A',
      'source_text','Tuyển gấp nhân viên bán hàng, lương cao. LH 0912 000 111','employer_phone','0912000111','location','Bắc Ninh'));
 b := public.ingest_job(jsonb_build_object('channel','sql_file','title','Tuyển nhân viên','company','Fixture Area B',
      'source_text','Cửa hàng ở Ngô Tất Tố - TP. Bắc Ninh tuyển nhân viên. LH 0912 000 222','employer_phone','0912000222','location','TP. Bắc Ninh'));
 c := public.ingest_job(jsonb_build_object('channel','sql_file','title','Tuyển nhân viên','company','Fixture Area C',
      'source_text','Làm việc tại Bắc Ninh. LH 0912 000 333','employer_phone','0912000333','location','TP. Bắc Ninh'));
 perform location_private.write_location(a,'upsert',jsonb_build_object('address','Bắc Ninh','authority','unresolved'));
 perform location_private.write_location(b,'upsert',jsonb_build_object('address','TP. Bắc Ninh','authority','unresolved'));
 perform location_private.write_location(c,'upsert',jsonb_build_object('address','TP. Bắc Ninh','authority','unresolved'));
 if exists(select 1 from public.job_work_locations where job_id=a and (point_kind<>'unresolved' or lat is not null)) then
  raise exception 'FAIL 원문에 성/시 이름이 없는데 대략 핀이 찍힘'; end if;
 select point_evidence->>'administrativeAreaKey' into k from public.job_work_locations where job_id=b and point_kind='area';
 if k is distinct from 'city:bac ninh' then raise exception 'FAIL 원문에 TP. Bắc Ninh가 있으면 시 대략 핀이어야 함: %', k; end if;
 select point_evidence->>'administrativeAreaKey' into k from public.job_work_locations where job_id=c and point_kind='area';
 if k is distinct from 'province:bac ninh' then raise exception 'FAIL 원문에 성 이름만 있으면 성 대략 핀이어야 함: %', k; end if;
 if exists(select 1 from public.job_work_locations where job_id in (a,b,c) and location_verified) then
  raise exception 'FAIL 대략 핀이 확인된 위치로 올라감'; end if;
 raise notice 'PASS: area pin needs source text';
end $$;
rollback;

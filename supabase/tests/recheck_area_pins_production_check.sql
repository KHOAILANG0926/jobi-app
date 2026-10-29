-- Read-only. 20261029140000 운영 점검: 다시 찾기는 요청만 보낸다(위치 결과는 같은 hook·canonical writer). 
-- 다시 찾기 뒤에도 원문에 없는 성/시 대략 핀이 없고 위치 정합성이 유지되는지 확인한다.
do $check$
begin
 if to_regprocedure('public.map_r1_request_location(bigint,boolean)') is null then raise exception 'recheck: map_r1_request_location 없음'; end if;
 if has_function_privilege('anon','public.map_r1_request_location(bigint,boolean)','execute')
  or has_function_privilege('authenticated','public.map_r1_request_location(bigint,boolean)','execute') then raise exception 'recheck: 위치 요청 함수 공개 실행 권한'; end if;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'recheck: canonical location integrity mismatch'; end if;
end $check$;

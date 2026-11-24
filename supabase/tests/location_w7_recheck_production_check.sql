-- 20261124160000: 위치 다시 확인은 기존 요청 함수로만 한다(새 경로 없음) — 요청 함수가 있고 공개 역할에 열리지 않았는지 확인.
do $t$ begin
 if to_regprocedure('public.map_r1_request_location(bigint,boolean)') is null then raise exception 'map_r1_request_location missing'; end if;
 if has_function_privilege('anon','public.map_r1_request_location(bigint,boolean)','execute') or has_function_privilege('authenticated','public.map_r1_request_location(bigint,boolean)','execute') then raise exception 'map_r1_request_location exposed'; end if;
end $t$;

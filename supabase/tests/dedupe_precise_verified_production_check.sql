-- 운영 점검(읽기 전용): 중복 판정 정확한 점 = exact+확인됨/gate/관리자 확정 (Lee 2026-11-07).
do $check$
declare def text;
begin
  select pg_get_functiondef('dedupe_private.precise_points(bigint)'::regprocedure) into def;
  if position('location_verified' in def) = 0 then raise exception 'precise_points에 확인됨 조건 없음'; end if;
  if has_function_privilege('anon', 'dedupe_private.precise_points(bigint)', 'execute') then raise exception 'precise_points 외부에 열림'; end if;
  raise notice 'dedupe_precise_verified production check passed';
end $check$;

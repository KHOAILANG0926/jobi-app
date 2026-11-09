-- 운영 점검(읽기 전용): Google 30일 정리 함수가 있고 서버 키만 부를 수 있다.
do $check$
begin
  if to_regprocedure('public.google_cache_expire(integer)') is null then raise exception 'Google 30일 정리 함수 없음'; end if;
  if has_function_privilege('anon', 'public.google_cache_expire(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.google_cache_expire(integer)', 'execute') then
    raise exception 'Google 30일 정리 함수가 외부에 열림';
  end if;
  if not has_function_privilege('service_role', 'public.google_cache_expire(integer)', 'execute') then
    raise exception '서버 키가 Google 30일 정리를 부를 수 없음';
  end if;
end $check$;

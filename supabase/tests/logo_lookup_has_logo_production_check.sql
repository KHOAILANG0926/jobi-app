-- 운영 점검(읽기 전용): 로고 기록 함수가 has_logo를 받고, 외부에서 부르지 못한다(Codex #619, Lee 2026-11-10).
do $check$
begin
  if pg_get_functiondef('public.job_logo_lookup_record(bigint,text,text,text)'::regprocedure) not like '%''has_logo''%' then
    raise exception '로고 기록 함수에 has_logo 없음';
  end if;
  if has_function_privilege('anon', 'public.job_logo_lookup_record(bigint,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.job_logo_lookup_record(bigint,text,text,text)', 'execute') then
    raise exception '로고 기록 함수가 외부에 열림';
  end if;
end $check$;

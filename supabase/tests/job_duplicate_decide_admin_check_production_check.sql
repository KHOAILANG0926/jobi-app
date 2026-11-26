-- 읽기 전용 운영 점검(데이터 변경 없음): 중복 확정 함수의 관리자 확인이 호출 연결·요청 토큰 기준으로 바뀌었는지.
\set ON_ERROR_STOP 1
do $$
declare d text := pg_get_functiondef('public.job_duplicate_decide(bigint,text)'::regprocedure);
begin
 if position('session_user in' in d) = 0 then raise exception 'duplicate decide admin check: 새 관리자 확인이 없음'; end if;
 if position('current_user in (' in d) > 0 then raise exception 'duplicate decide admin check: 옛 current_user 확인이 남음(일반 계정이 통과)'; end if;
 if has_function_privilege('anon', 'public.job_duplicate_decide(bigint,text)', 'execute') then raise exception 'duplicate decide admin check: anon이 실행 가능'; end if;
end $$;
select 'PASS: job_duplicate_decide_admin_check production check' as result;

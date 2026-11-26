-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 적용 뒤 본문이 바뀌었는지만 확인 — 역할별 실제 동작은 job_duplicate_decide_admin_check.concurrent.mjs.
\set ON_ERROR_STOP 1
do $$
declare d text := pg_get_functiondef('public.job_duplicate_decide(bigint,text)'::regprocedure);
begin
 if position('session_user in' in d) = 0 then raise exception 'duplicate decide admin check: 새 관리자 확인이 없음'; end if;
 if position('current_user in (' in d) > 0 then raise exception 'duplicate decide admin check: 옛 current_user 확인이 남음'; end if;
 if not (select p.prosecdef from pg_proc p where p.oid = 'public.job_duplicate_decide(bigint,text)'::regprocedure) then raise exception 'duplicate decide admin check: definer가 아님(기존 설계 유지)'; end if;
end $$;
select 'PASS: job_duplicate_decide_admin_check local' as result;

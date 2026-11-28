-- 읽기 전용 운영 점검(데이터 변경 없음): 지원 저장 정책에 기업 계정 거절 조건이 적용됐고 기존 조건(본인 이름·열린 기업 공고·정상 상태)이 그대로인지.
\set ON_ERROR_STOP 1
do $$
declare q text;
begin
  select pg_get_expr(p.polwithcheck, p.polrelid) into q from pg_policy p where p.polrelid = 'public.applications'::regclass and p.polname = 'applications_insert' and p.polcmd = 'a';
  if q is null then raise exception 'applications_insert 정책이 없음'; end if;
  if position('account_roles' in q) = 0 or position('employer' in q) = 0 then raise exception 'applications_insert: 기업 계정 거절 조건이 없음'; end if;
  if position('is_account_active' in q) = 0 or position('seeker_id' in q) = 0 or position('submitted' in q) = 0 or position('local_jobs' in q) = 0 then raise exception 'applications_insert: 기존 조건이 사라짐'; end if;
end $$;
select 'PASS: applications_insert_not_employer production check' as result;

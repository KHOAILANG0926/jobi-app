-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 20261128060000_applications_insert_not_employer 적용 뒤 실행 — 정책 본문에 기업 계정 거절 조건이 들어갔는지만 확인.
-- 실제 동작(구직자 지원 성공·기업 계정 거절·기존 조건 유지)은 applications_insert_not_employer.pglite.test.mjs가 시험한다.
\set ON_ERROR_STOP 1
do $$
declare q text;
begin
  select pg_get_expr(p.polwithcheck, p.polrelid) into q from pg_policy p where p.polrelid = 'public.applications'::regclass and p.polname = 'applications_insert';
  if q is null then raise exception 'applications_insert 정책이 없음'; end if;
  if position('account_roles' in q) = 0 or position('employer' in q) = 0 then raise exception 'applications_insert: 기업 계정 거절 조건이 없음'; end if;
end $$;
select 'PASS: applications_insert_not_employer local' as result;

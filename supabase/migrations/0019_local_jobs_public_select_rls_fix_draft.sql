-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
--
-- 배경(2026-09-04, 사용자 지시 — RLS 보안 감사 P1, RLS_SECURITY_AUDIT.md 참고):
-- 운영 DB를 MCP로 직접 조회하고 anon key로 실제 REST 재현 테스트를 한 결과,
-- 아래 두 가지를 실측/정책 텍스트로 확인했다.
--
-- 1. local_jobs_public_select(현재 운영 중, migration 0009가 만듦)이
--    "admin_hidden = false OR is_admin()"만 확인하고 active를 전혀 보지
--    않는다 — active=false인 크롤러 공고(sb-4366~4368)가 anon key만으로
--    REST에서 그대로 노출됨을 실측 확인했다(GET /rest/v1/local_jobs).
-- 2. job_work_locations_public_select가 "using (true)"라 필터가 전혀 없다
--    — local_jobs 쪽을 아무리 숨겨도 이 테이블을 직접 조회하면 raw_address/
--    lat/lng이 무조건 노출된다.
--
-- 이 migration은 이 두 SELECT 정책만 DROP 후 CREATE로 교체한다.
-- INSERT/UPDATE/DELETE 정책, 테이블 구조, 다른 테이블은 전혀 건드리지
-- 않는다. GRANT/REVOKE도 이 두 정책이 적용되는 SELECT 자체와는 무관해
-- 손대지 않는다(테이블 레벨 GRANT는 이미 올바름 — RLS가 그 안에서 행을
-- 더 좁히는 것뿐).
--
-- 공개 조건을 하나의 SQL 함수(local_job_is_visible)로 뽑아 local_jobs
-- 자신의 정책과 job_work_locations의 EXISTS 서브쿼리 둘 다에서 재사용한다
-- — 두 정책이 서로 다른 문구로 따로 유지되다 시간이 지나며 어긋나는
-- 위험을 없애기 위함(단일 진실 공급원). 이 함수는:
--   * 테이블을 전혀 조회하지 않고 호출자가 넘긴 값(active/admin_hidden/
--     employer_id)만 본다 — SECURITY DEFINER가 전혀 필요 없다(권한 상승
--     불필요, SECURITY INVOKER가 기본값이자 최소권한 원칙에 맞음 —
--     아래에 명시적으로 적어 둔다).
--   * public.is_admin()을 그대로 재사용한다(이미 운영 중인 함수, 새로
--     만들지 않음 — app_metadata.role='admin' 확인, 클라이언트가 위조
--     불가).
--   * employer_id는 실제 소유자 판별에 쓰이는 컬럼(migration 0004에서
--     추가, local_jobs_employer_insert/update/delete가 이미 이 컬럼과
--     auth.uid()를 비교하는 데 쓰고 있음) — user_metadata.role 같은
--     클라이언트가 바꿀 수 있는 값은 전혀 쓰지 않는다.
--
-- RLS 재귀 검토: job_work_locations_public_select의 EXISTS 서브쿼리가
-- local_jobs를 조회할 때, 호출자가 anon/authenticated이면 그 조회 자체에도
-- local_jobs의 RLS(local_jobs_public_select)가 적용된다 — 하지만
-- local_jobs_public_select는 오직 자기 자신의 컬럼(active/admin_hidden/
-- employer_id)과 is_admin()만 보고 job_work_locations를 전혀 참조하지
-- 않으므로, 참조 방향이 "job_work_locations -> local_jobs" 한 방향뿐이다.
-- 순환(local_jobs가 다시 job_work_locations를 참조)이 없으므로 무한
-- policy evaluation 위험이 없다.

begin;

create or replace function public.local_job_is_visible(
  p_active boolean,
  p_admin_hidden boolean,
  p_employer_id uuid
) returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (p_active is true and p_admin_hidden is false)
    or (auth.uid() is not null and p_employer_id is not null and p_employer_id = auth.uid())
    or public.is_admin();
$$;

comment on function public.local_job_is_visible(boolean, boolean, uuid) is
  '한 근무공고(local_jobs 행)를 지금 요청 중인 role(anon/authenticated)이 SELECT해도 되는지 — (1) 공개(active=true and admin_hidden=false) (2) 본인 소유(employer_id=auth.uid()) (3) 관리자(is_admin()) 셋 중 하나. local_jobs_public_select와 job_work_locations_public_select가 공유하는 단일 진실 공급원 — 둘 중 하나만 고치고 다른 하나를 잊어버리는 사고를 막기 위함. 테이블을 조회하지 않아 SECURITY DEFINER가 불필요(INVOKER, 최소 권한).';

revoke all on function public.local_job_is_visible(boolean, boolean, uuid) from public;
grant execute on function public.local_job_is_visible(boolean, boolean, uuid) to anon, authenticated;

drop policy if exists local_jobs_public_select on public.local_jobs;
create policy local_jobs_public_select on public.local_jobs
  for select to anon, authenticated
  using (public.local_job_is_visible(active, admin_hidden, employer_id));

drop policy if exists job_work_locations_public_select on public.job_work_locations;
create policy job_work_locations_public_select on public.job_work_locations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.local_jobs l
      where l.id = job_work_locations.job_id
        and public.local_job_is_visible(l.active, l.admin_hidden, l.employer_id)
    )
  );

-- 아래는 의도적으로 변경하지 않는다(그대로 유지됨을 명시적으로 남겨
-- 검토자가 "빠뜨린 게 아니라 일부러 안 건드렸다"는 걸 알 수 있게 함):
--   local_jobs_employer_insert / local_jobs_employer_update / local_jobs_employer_delete
--   job_work_locations_owner_write
--   다른 모든 테이블의 정책, GRANT/REVOKE, is_admin()/is_account_active()/require_admin()

commit;

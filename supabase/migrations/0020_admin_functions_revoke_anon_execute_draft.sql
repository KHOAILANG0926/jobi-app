-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
-- 별도 보안 강화 항목 — 0019(P1: local_jobs/job_work_locations 노출 수정)와
-- 독립적이며, 함께 실행하거나 따로 실행해도 무방하다.
--
-- 배경(2026-09-04, RLS 감사 중 Supabase 자체 보안 린터(get_advisors)로 발견):
-- admin_create_job / admin_handle_report / admin_list_users /
-- admin_set_account_status / admin_set_job_hidden 5개 SECURITY DEFINER
-- 함수의 EXECUTE 권한이 anon/authenticated(정확히는 PUBLIC 경유)까지 열려
-- 있다.
--
-- 실제 위험도 확인: 5개 함수 전부 본문 첫 줄에서 public.require_admin()을
-- 호출하고, require_admin()은 "auth.uid() is null or app_metadata.role
-- <> 'admin'"이면 즉시 예외(errcode 42501)를 던진다 — app_metadata는
-- 서버(service_role)만 설정 가능해 클라이언트가 위조할 수 없으므로,
-- **지금 당장 익스플로잇 가능한 취약점은 아니다**(런타임에 확실히 막힘,
-- RLS_SECURITY_AUDIT.md 2번 참고). 다만 GRANT 자체가 필요 이상으로 넓은
-- 것은 방어심층 원칙에 어긋나고, 실수로 require_admin() 호출이 빠진 새
-- admin_* 함수가 나중에 추가될 때의 위험을 키운다.
--
-- 실제 호출 경로 확인(추측 아님): 관리자는 RequireAdmin.tsx를 통해
-- 일반 로그인 세션(= authenticated role)으로 앱에 들어오고, 그 세션으로
-- 이 RPC들을 호출한다 — "admin"이라는 별도 Postgres role은 존재하지
-- 않는다(is_admin()/require_admin()이 보는 건 JWT의 app_metadata.role
-- 클레임이지 Postgres GRANT 대상 role이 아님). 즉 authenticated에서
-- EXECUTE를 빼면 관리자 자신도 호출하지 못하게 되므로, authenticated는
-- 유지하고 anon(비로그인)만 제거한다 — 비로그인 상태로 이 함수들을 쓸
-- 정상 시나리오는 없다.

begin;

revoke execute on function public.admin_create_job(jsonb) from anon;
revoke execute on function public.admin_handle_report(uuid, text, text) from anon;
revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.admin_set_account_status(uuid, text, text) from anon;
revoke execute on function public.admin_set_job_hidden(bigint, boolean, text) from anon;

-- authenticated는 그대로 둔다(관리자 세션이 이 role로 호출함) — require_admin()이
-- 관리자가 아닌 authenticated 사용자는 계속 예외로 막는다. PUBLIC 경유
-- 상속도 위 revoke가 anon에 대해서는 이미 효과적으로 차단하지만, 명시성을
-- 위해 PUBLIC에서도 한 번 더 명시적으로 제거한다(향후 새로 생기는 role이
-- PUBLIC을 통해 실수로 상속받는 것을 방지).
revoke execute on function public.admin_create_job(jsonb) from public;
revoke execute on function public.admin_handle_report(uuid, text, text) from public;
revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_set_account_status(uuid, text, text) from public;
revoke execute on function public.admin_set_job_hidden(bigint, boolean, text) from public;
grant execute on function public.admin_create_job(jsonb) to authenticated;
grant execute on function public.admin_handle_report(uuid, text, text) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_job_hidden(bigint, boolean, text) to authenticated;

commit;

-- 관리자 함수 4개의 비로그인(anon)·PUBLIC 실행 권한 회수(Lee 2026-11-26 승인 방향, 실제 적용은 이 PR의 Lee Approve 뒤 migrations-apply).
-- 근거(#1070): 0020_admin_functions_revoke_anon_execute_draft.sql은 초안이며 자동 적용 CUTOFF 이전 번호라 운영에 적용된 적이 없다 —
--   운영 구조 지문(Lee 실행 45828209586)에서 이 4개는 anon 실행 가능, 저장소 chain은 anon 불가로 갈렸다. 같은 내용을 정식 번호로 적용한다.
-- 악용 가능성: 4개 모두 본문 첫 줄 public.require_admin()이 비로그인·일반 계정을 42501로 막는다 — 격리 실제 스택에서
--   익명·일반 구직자 호출 거부와 데이터 불변을 확인했다(#1116·#1121). 이 회수는 방어 심층(앞으로 require_admin이 빠진 함수가 생겨도 비로그인 차단).
-- 기능 영향: 호출하는 곳은 관리자 화면(src/lib/adminOperations.ts)·서버 API(api/_lib/admin-users.js)로 모두 로그인 세션(authenticated) — 그대로 둔다.
-- admin_create_job은 20261029010000_ingest_one_door에서 이미 회수됐으므로 대상이 아니다.
revoke execute on function public.admin_handle_report(uuid, text, text) from anon, public;
revoke execute on function public.admin_list_users() from anon, public;
revoke execute on function public.admin_set_account_status(uuid, text, text) from anon, public;
revoke execute on function public.admin_set_job_hidden(bigint, boolean, text) from anon, public;
grant execute on function public.admin_handle_report(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_list_users() to authenticated, service_role;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_set_job_hidden(bigint, boolean, text) to authenticated, service_role;

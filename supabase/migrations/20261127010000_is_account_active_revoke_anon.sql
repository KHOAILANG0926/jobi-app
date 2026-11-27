-- is_account_active 비로그인(anon)·PUBLIC 실행 권한 회수(#1070 4번 — Lee 승인 PR로만 적용, 실제 적용은 이 PR의 Approve 뒤 migrations-apply).
-- 지금: 비로그인이 임의 사용자 번호(uuid)의 계정 활성 여부를 물을 수 있다(격리 실제 스택 E1: anon 호출 HTTP 200). 노출 내용은 불리언 하나지만 필요 없는 권한이다.
-- 영향 확인(격리 실제 스택 E2·E4·E5·E6, 정정된 시험): 회수해도 깨지는 익명 흐름 없음 — 공개 공고 목록·게스트 등록(ingest_job)·게스트 관리 링크(get_guest_job, 소유 확인은 함수 안 토큰)가 그대로.
--   (이전 보고의 'get_guest_job이 깨진다'는 같은 글 두 게스트 등록이 중복으로 합쳐진 시험 오류였다.)
-- 이 함수를 부르는 곳: ① 로그인 사용자 정책(applications_insert·job_alerts 등, 대상 역할 authenticated) ② SECURITY DEFINER 함수 안(can_manage_local_job 등 — 소유자 권한으로 실행되어 영향 없음)
--   ③ storage.objects의 cv_photos_*_application_snapshot(역할 public, 운영 구조 지문 45828209586): anon은 저장소에서 이미 이 정책의 applications 조회 권한이 없어 읽기·쓰기가 거부되고,
--   회수 뒤에는 거부 메시지만 '권한 오류'로 바뀐다(E6a·E6). 운영에 anon이 쓰는 저장소 정책은 이 구조 지문에 없다.
-- authenticated(정책 평가·관리자 화면)와 service_role(서버)은 그대로 둔다.
revoke execute on function public.is_account_active(uuid) from anon, public;
grant execute on function public.is_account_active(uuid) to authenticated, service_role;

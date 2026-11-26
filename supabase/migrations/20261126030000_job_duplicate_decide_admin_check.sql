-- 보안 결함 수정(통합 운영 정상화 2·3순위 DB 검증이 실제 DB로 재현, 2026-11-26): job_duplicate_decide의 관리자 확인이 항상 통과한다.
-- 원인: 이 함수는 SECURITY DEFINER라 본문 안의 current_user는 호출자가 아니라 함수 소유자(postgres)다 → `current_user in ('postgres', ...)`가 늘 참이어서
--   authenticated로 부르는 누구나 중복 의심(suspect) 공고를 '중복'(비공개)·'중복 아님'(공개)으로 확정할 수 있다(권한은 authenticated·service_role에 열려 있음).
-- 고침: 호출자 판별을 호출 연결(session_user)과 요청 토큰으로 한다 — 직접 연결(마이그레이션·승인된 DB 작업)은 session_user가 postgres·supabase_admin,
--   서버 키 호출은 요청 토큰 역할이 service_role, 로그인 사용자는 is_admin()(관리자 토큰). 그 밖(일반 기업·구직자 계정)은 거부.
--   정상 호출 경로(api/_lib/admin-users.js — 관리자 확인 뒤 서버 키로 rpc)는 그대로 통과한다.
-- 함수 본문에서 그 한 줄만 바꾼다(앞선 패치들과 같은 방식: 줄이 없거나 둘이면 RAISE로 전체 취소). 데이터 변경 없음.
-- 되돌리기: 20261107070000 본문의 원래 줄로 복원하는 새 migration(결함 상태로 돌아가므로 권하지 않음).
begin;
do $patch$
declare definition text;
 old_line text := 'if not (current_user in (''postgres'', ''supabase_admin'', ''service_role'') or (auth.uid() is not null and public.is_admin())) then';
 new_line text := 'if not (session_user in (''postgres'', ''supabase_admin'') or coalesce(auth.role(), '''') = ''service_role'' or (auth.uid() is not null and public.is_admin())) then';
begin
 select pg_get_functiondef('public.job_duplicate_decide(bigint,text)'::regprocedure) into definition;
 if position('session_user in' in definition) > 0 then raise exception 'duplicate decide admin check: 이미 적용됨'; end if;
 if position(old_line in definition) = 0 then raise exception 'duplicate decide admin check: 관리자 확인 줄을 찾지 못함'; end if;
 if position(old_line in substr(definition, position(old_line in definition) + 1)) > 0 then raise exception 'duplicate decide admin check: 관리자 확인 줄이 둘 이상'; end if;
 execute replace(definition, old_line, new_line);
end $patch$;
commit;

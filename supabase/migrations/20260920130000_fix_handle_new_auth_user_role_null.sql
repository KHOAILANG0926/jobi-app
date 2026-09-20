-- handle_new_auth_user_role() NULL 처리 버그 수정.
-- 2026-09-20 발견(게스트 등록 기능 admin 화면 검증 중 role 메타데이터 없이
-- signUp()을 호출해봤다가 실제로 재현됨, auth_logs에서 원인 확인) —
-- SQL에서 `NULL not in ('seeker','employer')`는 거짓이 아니라 NULL(알 수
-- 없음)로 평가되기 때문에, raw_user_meta_data에 role 키 자체가 없는(NULL)
-- 신규 가입에서는 "역할 없으면 seeker로 기본값 처리"가 실행되지 않고
-- requested_role이 NULL로 남아 account_roles.role의 NOT NULL 제약을
-- 위반해 회원가입 전체가 500으로 실패했다(트랜잭션은 정상 롤백돼 DB
-- 오염은 없었음 — 실측 확인).
--
-- 오늘 새로 만든 "이메일로 등록"(게스트 공고) 경로는 항상 role: 'employer'를
-- 명시적으로 보내 이 버그의 영향을 받지 않지만(실제 두 차례 성공 테스트로
-- 확인됨), role 메타데이터를 안 보내는 가입 경로가 나중에 생기면(예:
-- 소셜 로그인, 관리자 도구) 똑같이 걸릴 수 있는 잠재 버그라 지금 고친다.
--
-- 고치는 방법은 coalesce()로 NULL을 먼저 'seeker'로 바꿔둔 다음 유효성
-- 검사하는 것뿐 — 그 외 로직/시그니처/권한은 전혀 건드리지 않는다.

begin;

create or replace function public.handle_new_auth_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'seeker');
  if requested_role not in ('seeker', 'employer') then
    requested_role := 'seeker';
  end if;

  insert into public.account_roles (user_id, role)
  values (new.id, requested_role)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

commit;

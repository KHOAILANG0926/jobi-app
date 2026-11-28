-- 기업 계정의 구직 지원 차단(대표 2026-11-28 지시 3): 지금 applications_insert 정책은 역할을 보지 않아 기업 계정도 공고에 '지원'을 저장할 수 있다
-- (격리 실제 스택 E2E AP5: 기업 계정 앱 지원 → 저장 1줄, supabase/tests/job_apply_and_contact_gate.concurrent.mjs A6 주석의 '별도 확인 항목').
-- 기존 정책(20260920043000)의 조건은 그대로 두고, 같은 정책에 한 줄만 더한다: 본인의 계정 역할(account_roles, 본인 줄은 읽기 정책 account_roles_select_own으로 읽힘)이 employer이면 거절.
-- 구직자·역할 줄이 없는 계정의 지원, 기존 지원 내역, 기업이 지원자를 보고 상태를 바꾸는 정책(select·update)은 바뀌지 않는다. 기존 데이터는 건드리지 않는다.
-- 정책을 지우고 다시 만들지 않고 그 자리에서 조건식만 바꾼다(alter policy) — 정책이 잠깐 없는 순간이 없고 삭제 문장이 없다.
alter policy applications_insert on public.applications
  with check (
    is_account_active(auth.uid())
    and seeker_id = auth.uid()
    and status = 'submitted'
    and not exists (select 1 from public.account_roles r where r.user_id = auth.uid() and r.role = 'employer')
    and exists (
      select 1 from public.local_jobs l
      where l.id = applications.job_id
        and l.employer_id is not null
        and l.employer_id = applications.employer_id
    )
  );

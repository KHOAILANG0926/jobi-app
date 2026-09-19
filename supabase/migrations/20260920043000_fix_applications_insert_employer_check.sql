-- 2026-09-20: applications_insert RLS 정책의 tautology 조건 수정
--
-- 기존 with_check 절에 있던 "l.employer_id = l.employer_id"는 항상 참인
-- tautology라 실질적인 검증 기능이 없었다(복사-붙여넣기 오타로 추정).
-- applications 테이블 자체에 employer_id 컬럼이 있고(클라이언트가 지원
-- 시점에 값을 보내 저장, applicationsStorage.ts 참고) 이걸 local_jobs의
-- 실제 소유 employer_id와 대조하는 게 원래 의도였다고 판단해
-- "l.employer_id = applications.employer_id"로 수정.
--
-- 수정 전 위험: 로그인한 구직자가 API를 직접 조작하면 실제 지원 대상
-- 공고(job_id)는 그대로 두고 employer_id만 다른(관련 없는) 기업으로
-- 바꿔서 저장할 수 있었음 — 그 기업 대시보드에 위조된 지원서가 나타날 수
-- 있는 데이터 무결성 문제.
--
-- 트랜잭션 롤백 기반 시뮬레이션(set_config+set local role authenticated)
-- 으로 검증: 정상 employer_id 지원은 계속 성공, 위조된 employer_id는
-- 정확히 차단됨을 확인.

drop policy if exists applications_insert on applications;

create policy applications_insert on applications
  for insert
  with check (
    is_account_active(auth.uid())
    and seeker_id = auth.uid()
    and status = 'submitted'
    and exists (
      select 1 from local_jobs l
      where l.id = applications.job_id
        and l.employer_id is not null
        and l.employer_id = applications.employer_id
    )
  );

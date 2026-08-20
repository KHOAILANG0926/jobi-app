-- local_jobs에 기업 소유권(employer_id)을 추가한다.
-- nullable로 추가하므로 기존 크롤링 공고(362건+)는 전부 NULL로 유지되고,
-- 아무 기존 동작도 깨지지 않는다. 다른 컬럼/테이블은 건드리지 않는다.

alter table local_jobs
  add column if not exists employer_id uuid references auth.users(id);

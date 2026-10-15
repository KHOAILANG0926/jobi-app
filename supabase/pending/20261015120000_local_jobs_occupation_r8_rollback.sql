-- 2026-10-15 롤백: 20261015120000_local_jobs_occupation_r8.sql 되돌리기. 두 칸에 저장된 분류 값은 사라진다(공고 자체·공개 상태는 영향 없음).
begin;
drop trigger if exists trg_zzz_local_jobs_occupation_r8 on public.local_jobs;
drop function if exists public.local_jobs_occupation_r8();
alter table public.local_jobs drop column if exists occupation_evidence;
alter table public.local_jobs drop column if exists occupation_code;
commit;

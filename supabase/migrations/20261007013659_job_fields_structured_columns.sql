-- 공고 항목 구조화 컬럼 9개 (docs/JOB_FIELDS_AND_DETAIL_DESIGN.md §3). 전부 nullable·default 없음·backfill 없음.
-- Production 적용 버전 20261007013659 (2026-10-07).
alter table public.local_jobs
  add column if not exists salary_basis text check (salary_basis in ('base','total_with_overtime')),
  add column if not exists salary_note text,
  add column if not exists employment_type text check (employment_type in ('full_time','seasonal','part_time')),
  add column if not exists rotating_shifts smallint check (rotating_shifts in (2,3)),
  add column if not exists benefit_tags text[],
  add column if not exists required_documents text,
  add column if not exists contact_zalo text;

alter table public.job_work_locations
  add column if not exists industrial_park text,
  add column if not exists shuttle_route text;

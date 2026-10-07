-- 언어 조건·출장 가능 여부 컬럼 + 원문 description 백업 테이블. Production 적용 버전 20261007031726 (2026-10-07).
alter table public.local_jobs
  add column if not exists language_requirement text,
  add column if not exists business_trip boolean;

-- 원문(description) 추출로 상세요강을 고치기 전 원본 보관. 공개 접근 없음(RLS 켬 + 정책 없음 + anon/authenticated 권한 회수).
create table if not exists public.local_jobs_description_backup (
  id bigint generated always as identity primary key,
  job_id bigint not null,
  description text,
  reason text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.local_jobs_description_backup enable row level security;
revoke all on public.local_jobs_description_backup from anon, authenticated;

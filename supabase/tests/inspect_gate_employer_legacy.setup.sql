-- 빈 시험 DB 준비: 시험 표(local_jobs)에 공개 게이트가 읽는 열을 더하고, 앞선 두 migration(지문 함수·트리거, 공개 중 유지)을 불러온다.
alter table public.local_jobs add column if not exists origin text, add column if not exists title text, add column if not exists description text,
  add column if not exists active boolean default true, add column if not exists ocr_check jsonb, add column if not exists urgent boolean;
\i supabase/migrations/20261101110000_job_inspect_content_hash.sql
\i supabase/migrations/20261101170000_inspect_keep_public.sql

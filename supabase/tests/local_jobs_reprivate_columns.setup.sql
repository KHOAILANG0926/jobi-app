-- 시험 DB 준비: 11-15 사고 상태 재현 — 비공개여야 할 칸까지 anon·authenticated에 칸 단위 select가 열린 local_jobs.
do $r$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $r$;
create table if not exists public.local_jobs (id bigint primary key);
alter table public.local_jobs
  add column if not exists title text, add column if not exists occupation_code text, add column if not exists company_domain text,
  add column if not exists recruiter_agency text, add column if not exists description_html text, add column if not exists employment_type_extra text,
  add column if not exists updated_at timestamptz, add column if not exists company_id bigint, add column if not exists company_branch_id bigint,
  add column if not exists duplicate_status text, add column if not exists duplicate_of bigint, add column if not exists duplicate_reason text,
  add column if not exists logo_lookup jsonb, add column if not exists agency_workplace_key text;
revoke select on public.local_jobs from anon, authenticated;
do $g$ declare cols text; begin
  select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
   where table_schema = 'public' and table_name = 'local_jobs' and column_name not in ('source_url','source_text','ocr_text','ocr_check','guest_manage_token');
  execute format('grant select (%s) on public.local_jobs to anon, authenticated', cols);
end $g$;
do $s$ begin
  if not has_column_privilege('anon', 'public.local_jobs', 'agency_workplace_key', 'select') then raise exception '준비 실패: 사고 상태가 재현되지 않음'; end if;
end $s$;

-- 상세요강 줄 번호표(칸) 저장소 — 2026-10-25 Lee 결정("단어 규칙으로는 끝이 없다").
-- 단어 규칙이 칸을 못 정한 줄을 AI가 정해진 칸(01~07) 중에서 고르면 여기에 저장한다 → 같은 줄은 다음부터 AI 없이 바로 그 칸.
-- Lee가 관리자 화면에서 고르면 decided_by='lee'로 덮어쓴다(AI는 Lee가 정한 줄을 바꾸지 못함).
create table if not exists public.detail_line_kinds (
  line_key text primary key,
  section text not null check (section in ('01','02','03','04','05','06','07')),
  example text not null,
  decided_by text not null check (decided_by in ('ai','lee')),
  decided_at timestamptz not null default now()
);
alter table public.detail_line_kinds enable row level security;
revoke all on public.detail_line_kinds from public, anon, authenticated;
grant select, insert, update on public.detail_line_kinds to service_role;

-- AI는 Lee가 정한 줄을 덮어쓸 수 없다
create or replace function public.detail_line_kinds_keep_lee() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.decided_by = 'lee' and new.decided_by = 'ai' then return old; end if;
  new.decided_at := now();
  return new;
end $$;
drop trigger if exists trg_detail_line_kinds_keep_lee on public.detail_line_kinds;
create trigger trg_detail_line_kinds_keep_lee before update on public.detail_line_kinds
  for each row execute function public.detail_line_kinds_keep_lee();

-- 2026-10-15 [2026-10-15 사용자 승인 — 병합 시 occupation-master-apply.yml 로 적용] 베트남 공식 직업분류(QĐ 34/2020/QĐ-TTg) 마스터 테이블.
--
-- 목적: 직업군을 자체 제작 24개 분류가 아니라 정부 공식 5단계 코드에 묶는다.
--   데이터는 data/occupations/34-2020/*.json (관보 .doc 원본에서 추출, SHA256: source/MANIFEST.json).
--   입력 SQL은 20261015100100_occupation_master_seed.sql (scripts/occupations/build_seed_sql.py 로 생성).
--
-- 설계 원칙
-- - 순수 additive: 기존 테이블(local_jobs 등)·컬럼·RLS·함수는 변경하지 않는다. (R8 연결은 다음 단계)
-- - 공식 공개 자료이므로 anon/authenticated 는 읽기만. 쓰기 정책 없음 → 쓰기는 service_role(마이그레이션)만.
-- - 코드는 text(앞자리 0 유지: 0, 01, 011 ...). 코드 길이 = 단계, 하위 코드는 상위 코드로 시작.
-- - 롤백: 20261015100000_occupation_master_rollback.sql
-- - 승인 전에는 아무것도 적용하지 않는다. 적용 후 supabase/migrations/ 로 옮기고 기록한다.

begin;

create table if not exists public.occupation_master (
  code text primary key check (code ~ '^[0-9]{1,5}$'),
  level smallint not null check (level between 1 and 5),
  parent_code text references public.occupation_master(code),
  name_vi text not null check (length(trim(name_vi)) > 0),
  source_file text not null,
  source_row integer not null,
  created_at timestamptz not null default now(),
  constraint occupation_master_level_len check (length(code) = level),
  constraint occupation_master_parent_rule check (
    (level = 1 and parent_code is null)
    or (level > 1 and parent_code is not null and length(parent_code) = level - 1 and code like parent_code || '%')
  )
);
create index if not exists occupation_master_parent_idx on public.occupation_master (parent_code);

create table if not exists public.occupation_descriptions (
  code text primary key references public.occupation_master(code) on delete cascade,
  description text,
  main_tasks text[] not null default '{}',
  examples text[] not null default '{}',
  exclusions text[] not null default '{}',
  skill_note text,
  source_file text not null,
  source_paragraph integer not null
);

create table if not exists public.occupation_aliases (
  id bigint generated always as identity primary key,
  code text not null references public.occupation_master(code) on delete cascade,
  alias_vi text not null check (length(trim(alias_vi)) > 0),
  source text not null check (source in ('appendix_ii_title')),   -- 확인된 출처만. 다른 출처는 추가 승인 후 확장
  unique (code, alias_vi)
);
create index if not exists occupation_aliases_code_idx on public.occupation_aliases (code);

alter table public.occupation_master enable row level security;
alter table public.occupation_descriptions enable row level security;
alter table public.occupation_aliases enable row level security;

revoke all on public.occupation_master, public.occupation_descriptions, public.occupation_aliases from anon, authenticated;
grant select on public.occupation_master, public.occupation_descriptions, public.occupation_aliases to anon, authenticated;

drop policy if exists occupation_master_public_read on public.occupation_master;
create policy occupation_master_public_read on public.occupation_master for select to anon, authenticated using (true);
drop policy if exists occupation_descriptions_public_read on public.occupation_descriptions;
create policy occupation_descriptions_public_read on public.occupation_descriptions for select to anon, authenticated using (true);
drop policy if exists occupation_aliases_public_read on public.occupation_aliases;
create policy occupation_aliases_public_read on public.occupation_aliases for select to anon, authenticated using (true);

commit;

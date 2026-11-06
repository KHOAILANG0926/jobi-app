-- 회사 코드표 (Lee 2026-11-06 중복 2단계 승인 "진행해").
-- 원칙: 공고 중복 = 같은 회사·같은 일·같은 위치. 회사는 따로, 지점은 따로.
--   회사 = 핵심 이름(회사 형태·가게 종류 낱말 빼고, 끝에 붙은 지역·지점명은 지점으로 뗀 이름) + 업종(처음 정한 값을 기억).
--   계산 규칙은 src/lib/jobIdentity.ts(companyCore·kindsCompatible)와 같다.
-- 이 파일은 빈 표와 공고 연결 빈 칸만 만든다. 기존 공고 연결(3단계)·입구 규칙(4단계)은 별도 승인. 공고 내용·화면 변경 없음.
-- 변경안: supabase/pending/company-code-20261106/01-schema-dryrun.sql

do $pre$
begin
  if to_regclass('public.job_companies') is not null or to_regclass('public.job_company_names') is not null
     or to_regclass('public.job_company_phones') is not null or to_regclass('public.job_company_branches') is not null then
    raise exception 'company codes: 표가 이미 있음 — 다른 경로로 만들어졌는지 확인 필요';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs'
             and column_name in ('company_id', 'company_branch_id')) then
    raise exception 'company codes: local_jobs.company_id/company_branch_id 칸이 이미 있음';
  end if;
end $pre$;

-- 회사: 핵심 이름 + 업종. 같은 핵심 이름이라도 업종이 맞지 않으면 다른 회사(카페 ≠ 식당).
create table public.job_companies (
  id bigint generated always as identity primary key,
  core text not null check (core ~ '^[a-z0-9]+$' and length(core) between 1 and 120),
  kind text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index job_companies_core_kind on public.job_companies (core, coalesce(kind, ''));
comment on table public.job_companies is
  '공고 회사 코드표(Lee 2026-11-06). 회사 = 핵심 이름 + 업종(처음 정한 값 기억, 큰 분류 → 그 아래 소분류로만 구체화). 지점은 job_company_branches. 규칙: src/lib/jobIdentity.ts';
comment on column public.job_companies.kind is '가게 종류 소분류(예: quan_ca_phe, nha_hang) 또는 큰 분류. 처음 정한 값을 기억해 같은 회사가 공고마다 다른 업종으로 갈리지 않게 한다.';

-- 회사가 쓴 이름·번호 — 같은 회사로 묶는 근거. 이름 없는 공고는 번호로 찾는다.
create table public.job_company_names (
  company_id bigint not null references public.job_companies(id) on delete restrict,
  raw_name text not null check (length(btrim(raw_name)) > 0),
  primary key (company_id, raw_name)
);
create table public.job_company_phones (
  company_id bigint not null references public.job_companies(id) on delete restrict,
  phone text not null check (phone ~ '^0[0-9]{8,10}$'),
  primary key (company_id, phone)
);
create index job_company_phones_phone on public.job_company_phones (phone);

-- 지점: 회사 아래 지점명(건물·거리·동). 위치 원본은 job_work_locations 그대로.
create table public.job_company_branches (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.job_companies(id) on delete restrict,
  branch text not null default '',
  created_at timestamptz not null default now(),
  unique (company_id, branch)
);

-- 공고 → 회사·지점 연결 칸(3단계에서 채움). 공개 열 권한을 주지 않아 공개 조회에는 안 보인다(열 단위 권한).
alter table public.local_jobs
  add column company_id bigint references public.job_companies(id) on delete restrict,
  add column company_branch_id bigint references public.job_company_branches(id) on delete restrict;
create index local_jobs_company_id on public.local_jobs (company_id) where company_id is not null;
comment on column public.local_jobs.company_id is '회사 코드(job_companies). 중복 판단: 같은 회사·같은 일(occupation_code)·같은 위치(Lee 2026-11-06).';

-- 공개 접근 막음: 서버(입구 함수)만 읽고 쓴다.
alter table public.job_companies enable row level security;
alter table public.job_company_names enable row level security;
alter table public.job_company_phones enable row level security;
alter table public.job_company_branches enable row level security;
revoke all on public.job_companies, public.job_company_names, public.job_company_phones, public.job_company_branches from anon, authenticated;

-- 회사 코드표 — 변경안(DRY-RUN, 승인 전 적용 금지). Lee 2026-11-06 중복 2단계.
-- 원칙: 회사는 따로, 지점은 따로. 회사 = 핵심 이름 + 업종. 업종은 처음 정한 것을 기억해 같은 회사가 공고마다 갈리지 않게 한다.
-- 계산 규칙은 src/lib/jobIdentity.ts(companyCore·kindsCompatible)와 같다. 이 파일은 표만 만든다(기존 공고 연결은 3단계, 입구 규칙은 4단계).
begin;

-- 회사: 핵심 이름 + 업종 하나. 같은 핵심 이름이라도 업종이 맞지 않으면 다른 회사(카페 ≠ 식당, Lee 2026-11-06).
create table public.job_companies (
  id bigint generated always as identity primary key,
  core text not null check (core ~ '^[a-z0-9]+$' and length(core) between 1 and 120),
  kind text,                                   -- 가게 종류 소분류 또는 큰 분류(처음 정한 값, 더 구체적인 값이 오면 위로만 바꿈: 큰 분류 → 그 아래 소분류)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index job_companies_core_kind on public.job_companies (core, coalesce(kind, ''));
comment on table public.job_companies is
  '공고 회사 코드표(Lee 2026-11-06). 회사 = 핵심 이름(회사 형태·가게 종류 낱말 빼고, 끝에 붙은 지역·지점명은 지점으로 뗀 이름) + 업종. 지점은 job_company_branches.';

-- 회사가 쓴 이름·번호(같은 회사로 묶는 근거). 이름 없는 공고는 번호로 같은 회사를 찾는다.
create table public.job_company_names (
  company_id bigint not null references public.job_companies(id) on delete restrict,
  raw_name text not null,
  primary key (company_id, raw_name)
);
create table public.job_company_phones (
  company_id bigint not null references public.job_companies(id) on delete restrict,
  phone text not null check (phone ~ '^0[0-9]{8,10}$'),
  primary key (company_id, phone)
);

-- 지점: 회사 아래 지점명·위치(위치 원본은 job_work_locations 그대로, 여기는 지점 이름만).
create table public.job_company_branches (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.job_companies(id) on delete restrict,
  branch text not null default '',             -- 이름에서 뗀 지점명(건물·거리·동). 없으면 ''
  created_at timestamptz not null default now(),
  unique (company_id, branch)
);

-- 공고 → 회사·지점 연결 칸(3단계에서 채움, 지금은 빈 칸).
alter table public.local_jobs
  add column company_id bigint references public.job_companies(id) on delete restrict,
  add column company_branch_id bigint references public.job_company_branches(id) on delete restrict;
create index local_jobs_company_id on public.local_jobs (company_id) where company_id is not null;

-- 공개 접근 막음: 서버(입구 함수)만 읽고 쓴다.
alter table public.job_companies enable row level security;
alter table public.job_company_names enable row level security;
alter table public.job_company_phones enable row level security;
alter table public.job_company_branches enable row level security;
revoke all on public.job_companies, public.job_company_names, public.job_company_phones, public.job_company_branches from anon, authenticated;

-- dry-run: 결과만 보고 되돌린다.
select 'job_companies' as t, count(*) from public.job_companies
union all select 'local_jobs.company_id 채워진 수', count(*) from public.local_jobs where company_id is not null;
rollback;

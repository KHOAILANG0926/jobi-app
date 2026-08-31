-- korea_jobs를 MVP 실사용에 필요한 구조화 필드로 확장하고, korea_job_work_locations를
-- 신설한다. 순수 additive: 기존 korea_jobs 컬럼(id, created_at, title, company, region,
-- salary, deadline, source_url, description)과 기존 4개 행은 삭제/rename/타입변경하지
-- 않는다. local_jobs/job_work_locations는 이 migration에서 전혀 건드리지 않는다.
--
-- 데이터 보호 설계(Public UI에는 이 migration이 만드는 *_public 뷰만 노출한다):
--   - anon/authenticated는 베이스 테이블(korea_jobs, korea_job_work_locations)에 대한
--     권한을 전혀 갖지 않는다 — RLS와 별개로 GRANT 자체를 주지 않는다.
--   - 대신 공개용 컬럼만 골라 담은 뷰(korea_jobs_public)에만 SELECT를 준다. 이렇게 하면
--     프론트 쿼리 코드가 실수로 select('*')를 쓰더라도 애초에 내부 컬럼이 전송될 수 없다
--     (뷰 자체에 그 컬럼이 없으므로) — "React에서 안 보여준다"가 아니라 "전송 자체가
--     안 된다"는 요구사항을 DB 레벨에서 보장한다.
--   - 크롤러/관리자 쓰기는 service_role 키로만 한다(= RLS를 우회) — anon/authenticated용
--     쓰기 정책은 만들지 않는다.

begin;

-- ── 1. korea_jobs: 구조화 필드 추가 (전부 additive, 전부 nullable 기본) ──────────

alter table public.korea_jobs
  -- 표시/필터용 구조화 필드. 원문 자유텍스트인 region/salary/deadline/description은
  -- 그대로 두고, 검색·정렬에 쓸 구조화된 값을 별도 컬럼으로 공존시킨다.
  add column if not exists category text,
  add column if not exists province text,
  add column if not exists district text,

  add column if not exists salary_type text
    check (salary_type is null or salary_type in ('hourly', 'daily', 'monthly', 'annual', 'negotiable')),
  add column if not exists salary_min integer check (salary_min is null or salary_min >= 0),
  add column if not exists salary_max integer check (salary_max is null or salary_max >= 0),

  add column if not exists working_hours text,
  add column if not exists working_days text,
  add column if not exists days_off text,

  add column if not exists headcount integer check (headcount is null or headcount > 0),
  add column if not exists gender_condition text
    check (gender_condition is null or gender_condition in ('male', 'female', 'any')),
  add column if not exists age_condition text,
  add column if not exists korean_level_required text,
  add column if not exists experience_required text,
  add column if not exists visa_status_required text,

  add column if not exists dormitory boolean,
  add column if not exists meals boolean,
  add column if not exists transportation boolean,

  -- 지원자가 실제로 연락할 방법(전화/이메일/원본 공고 안내 등) — E2E 지원 흐름의 핵심.
  add column if not exists contact_method text,

  add column if not exists posted_at date,
  -- 시스템 만료 판단 기준. null이면 "명시된 마감 없음"(원문 deadline이 "채용시까지"인
  -- 경우 등) — 원문에 없는 마감일을 추정해서 채우지 않는다.
  add column if not exists expires_at timestamptz,
  -- 우리가 이 행을 수집한 시점. 크롤러 내부 메타데이터이며 공개 뷰에는 포함하지 않는다.
  add column if not exists collected_at timestamptz not null default now(),
  -- 사람이 원문 대조 검증을 마친 시점(있으면). 공개 뷰에는 포함하지 않는다.
  add column if not exists verified_at timestamptz,
  -- 수집 출처 태그(예: 'worknet') — 내부 분류용, 공개 뷰에는 포함하지 않는다.
  add column if not exists source_type text,

  -- 관리자/크롤러 워크플로 상태. 새로 들어오는 행은 기본 draft(비공개) — 명시적으로
  -- active로 바꾸기 전까지는 공개 뷰에 노출되지 않는다(검수 전 데이터 유출 방지).
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'active', 'closed', 'removed')),

  -- source_url을 공개 뷰에서 그대로 보여줄지 여부. 기본 false — 명시적으로 켠 행만
  -- 원본 링크를 노출한다.
  add column if not exists show_source_link boolean not null default false;

-- salary_max가 있으면 salary_min 이상이어야 한다(둘 다 있을 때만 체크).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'korea_jobs_salary_range_check'
      and conrelid = 'public.korea_jobs'::regclass
  ) then
    alter table public.korea_jobs
      add constraint korea_jobs_salary_range_check
      check (salary_min is null or salary_max is null or salary_max >= salary_min);
  end if;
end
$$;

-- 기존 4건 소급 처리 — 이미 갖고 있는 데이터에서 "확실히 알 수 있는" 값만 채운다.
-- source_url이 전부 work24.go.kr(고용24/WorkNet)이므로 source_type만 일괄 채우고,
-- collected_at은 실제 이 행들이 수집된 시점인 기존 created_at 값을 그대로 옮긴다
-- (지금 시점 now()로 채우면 "방금 수집한 것"처럼 왜곡되므로).
update public.korea_jobs
set source_type = 'worknet',
    collected_at = created_at
where source_type is null;

create index if not exists idx_korea_jobs_status on public.korea_jobs (status);
create index if not exists idx_korea_jobs_expires_at on public.korea_jobs (expires_at);

-- ── 2. korea_job_work_locations: 한국 공고 1:N 실제 근무지 ──────────────────────
-- job_work_locations(0010)의 검증된 구조(raw/normalized 주소 보존, geog 자동계산,
-- geocode_status, location_verified, sort_order)를 그대로 따르되, 컬럼명은 한국
-- 행정구역 체계(시/도 → 시/군/구 → 읍/면/동)에 맞춘다. country 컬럼은 두지 않는다
-- (이 테이블은 정의상 전부 한국 소재).
create table if not exists public.korea_job_work_locations (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.korea_jobs(id) on delete cascade,

  raw_address text not null,
  normalized_address text,

  sido text,          -- 시/도 (예: 인천광역시)
  sigungu text,        -- 시/군/구 (예: 서구)
  eupmyeondong text,   -- 읍/면/동 (원문에 없으면 비움)

  lat double precision,
  lng double precision,
  geog geography(Point, 4326)
    generated always as (
      case
        when lat is not null and lng is not null
          then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        else null
      end
    ) stored,

  geocode_status text not null default 'pending'
    check (geocode_status in ('pending', 'success', 'failed', 'manual')),
  geocode_source text,
  location_verified boolean not null default false,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'korea_job_work_locations_job_normaddr_key'
      and conrelid = 'public.korea_job_work_locations'::regclass
  ) then
    alter table public.korea_job_work_locations
      add constraint korea_job_work_locations_job_normaddr_key
      unique (job_id, normalized_address);
  end if;
end
$$;

create index if not exists idx_korea_job_work_locations_job_id
  on public.korea_job_work_locations (job_id);
create index if not exists idx_korea_job_work_locations_geog
  on public.korea_job_work_locations using gist (geog);

create or replace function public.korea_job_work_locations_fill_normalized()
returns trigger
language plpgsql
as $$
begin
  if new.normalized_address is null or btrim(new.normalized_address) = '' then
    new.normalized_address := regexp_replace(
      trim(both ' ' from lower(coalesce(new.raw_address, ''))),
      '\s+', ' ', 'g'
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_korea_job_work_locations_fill_normalized
  on public.korea_job_work_locations;
create trigger trg_korea_job_work_locations_fill_normalized
  before insert or update on public.korea_job_work_locations
  for each row execute function public.korea_job_work_locations_fill_normalized();

-- ── 3. RLS + 최소권한 GRANT ────────────────────────────────────────────────
alter table public.korea_jobs enable row level security;
alter table public.korea_job_work_locations enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('korea_jobs', 'korea_job_work_locations')
  loop
    execute format('drop policy if exists %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;
end
$$;

-- 베이스 테이블은 anon/authenticated에 GRANT 자체를 주지 않는다 — RLS 정책도 만들지
-- 않는다(정책이 없으면 RLS가 기본 차단하므로 이중으로 막힌다). service_role만 접근
-- 가능(= RLS 우회) — 크롤러/관리자 쓰기는 전부 이 경로로만 한다.
revoke all privileges on table public.korea_jobs from anon, authenticated;
revoke all privileges on table public.korea_job_work_locations from anon, authenticated;

-- ── 4. 공개 뷰 — public UI가 실제로 조회하는 대상은 이것뿐이다 ──────────────────
-- 내부 컬럼(collected_at, verified_at, source_type, status, show_source_link 원본값)은
-- 뷰 정의 자체에 아예 포함하지 않는다 — select('*')를 하더라도 내려갈 수 없다.
-- source_url은 show_source_link=true인 행만 실제 값을, 아니면 null을 내려준다.
-- 노출 대상은 status='active'이고 만료되지 않은(expires_at이 null이거나 미래) 행만.
create or replace view public.korea_jobs_public as
select
  id,
  created_at,
  title,
  company,
  region,
  salary,
  deadline,
  description,
  category,
  province,
  district,
  salary_type,
  salary_min,
  salary_max,
  working_hours,
  working_days,
  days_off,
  headcount,
  gender_condition,
  age_condition,
  korean_level_required,
  experience_required,
  visa_status_required,
  dormitory,
  meals,
  transportation,
  contact_method,
  posted_at,
  expires_at,
  case when show_source_link then source_url else null end as source_url
from public.korea_jobs
where status = 'active'
  and (expires_at is null or expires_at > now());

create or replace view public.korea_job_work_locations_public as
select
  id,
  job_id,
  raw_address,
  normalized_address,
  sido,
  sigungu,
  eupmyeondong,
  lat,
  lng,
  sort_order
from public.korea_job_work_locations wl
where exists (
  select 1 from public.korea_jobs j
  where j.id = wl.job_id and j.status = 'active'
    and (j.expires_at is null or j.expires_at > now())
);

grant select on public.korea_jobs_public to anon, authenticated;
grant select on public.korea_job_work_locations_public to anon, authenticated;

commit;

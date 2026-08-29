-- 공고 1건이 여러 실제 근무지를 가질 수 있도록 job_work_locations를 추가한다.
-- local_jobs.location(자유 텍스트)/lat/lng는 기존 호환을 위해 그대로 둔다 — 이 migration은
-- 순수 additive이며 기존 컬럼/제약/RLS/데이터를 변경하지 않는다.

begin;

-- ── 0. 필요한 확장 ──────────────────────────────────────────────
create extension if not exists postgis;
create extension if not exists unaccent;

-- ── 1. local_jobs: 원본 공고 URL 보존 (크롤러 출처 추적용, additive) ──
alter table public.local_jobs
  add column if not exists source_url text;

-- ── 2. job_work_locations: 공고 1:N 실제 근무지 ──────────────────
create table if not exists public.job_work_locations (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.local_jobs(id) on delete cascade,

  -- 원문 그대로 보존 — 절대 덮어쓰지 않음 (감사/재검증 근거).
  raw_address text not null,
  -- 매칭/중복판정용 정규화 주소. 비어 있으면 트리거가 raw_address로부터 자동 생성한다.
  normalized_address text,

  country text not null default 'VN',
  province text,
  district text,
  ward text,

  lat double precision,
  lng double precision,
  -- lat/lng가 둘 다 있을 때만 자동 계산되는 PostGIS geography 포인트.
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

-- 같은 공고 안에서 같은 정규화 주소가 중복 저장되지 않도록 방지.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_work_locations_job_normaddr_key'
      and conrelid = 'public.job_work_locations'::regclass
  ) then
    alter table public.job_work_locations
      add constraint job_work_locations_job_normaddr_key
      unique (job_id, normalized_address);
  end if;
end
$$;

create index if not exists idx_job_work_locations_job_id
  on public.job_work_locations (job_id);

create index if not exists idx_job_work_locations_geog
  on public.job_work_locations using gist (geog);

-- ── 3. normalized_address 자동 채움 트리거 ───────────────────────
-- raw_address만 넣고 normalized_address를 비워두면, unaccent+lower+공백정리로 자동 생성.
-- 이미 값이 있으면(크롤러/관리자가 명시적으로 지정) 그대로 존중하고 건드리지 않는다.
create or replace function public.job_work_locations_fill_normalized()
returns trigger
language plpgsql
as $$
begin
  if new.normalized_address is null or btrim(new.normalized_address) = '' then
    new.normalized_address := regexp_replace(
      trim(both ' ' from unaccent(lower(coalesce(new.raw_address, '')))),
      '\s+', ' ', 'g'
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_job_work_locations_fill_normalized
  on public.job_work_locations;
create trigger trg_job_work_locations_fill_normalized
  before insert or update on public.job_work_locations
  for each row execute function public.job_work_locations_fill_normalized();

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.job_work_locations enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'job_work_locations'
  loop
    execute format('drop policy if exists %I on public.job_work_locations', existing_policy.policyname);
  end loop;
end
$$;

-- 공개 조회는 local_jobs와 동일하게 전체 허용 (구직자 화면에서 근무지 표시용).
create policy job_work_locations_public_select on public.job_work_locations
  for select to anon, authenticated
  using (true);

-- 쓰기는 해당 공고를 소유한 기업 계정, 또는 admin만 가능. 크롤러는 service_role
-- 키로 동작하므로 RLS 자체가 적용되지 않음(기존 크롤러 insert 경로와 동일 전제).
create policy job_work_locations_owner_write on public.job_work_locations
  for all to authenticated
  using (
    exists (
      select 1 from public.local_jobs j
      where j.id = job_work_locations.job_id
        and j.employer_id = auth.uid()
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  with check (
    exists (
      select 1 from public.local_jobs j
      where j.id = job_work_locations.job_id
        and j.employer_id = auth.uid()
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

revoke all privileges on table public.job_work_locations from anon, authenticated;
grant select on table public.job_work_locations to anon, authenticated;
grant insert, update, delete on table public.job_work_locations to authenticated;

-- ── 5. geocode_cache: 주소→좌표 결과 캐시 (내부 전용, 프론트 접근 없음) ──
create table if not exists public.geocode_cache (
  id bigint generated always as identity primary key,
  query_text text not null unique,
  lat double precision,
  lng double precision,
  source text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;
-- anon/authenticated 접근 자체를 막는다 — 이 테이블은 크롤러/geocoder(service_role)
-- 전용 내부 캐시이며 프론트엔드가 직접 조회할 필요가 없다.
revoke all privileges on table public.geocode_cache from anon, authenticated;

commit;

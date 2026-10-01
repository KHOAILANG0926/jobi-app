-- 공고 근무조건 구조화(3차) + 게시자 지도 핀 (2026-10-01)
--
-- 목적: 메인 "내 주변 일자리" 지도 탐색(HomeMapExplorer)의 조건 필터와 지도 핀을 실제 데이터로 연결.
--
-- 원칙
-- - 새 조건 컬럼은 모두 NULL 허용이며 NULL = "정보 미확인". 기존 공고는 backfill 하지 않는다
--   (값이 없다고 false/없음/직접채용/주5일로 추정하지 않음).
-- - 근무 형태는 기존 local_jobs.shift_type(day/night/rotating/other, 20260923080000)을 그대로 쓴다.
-- - 지도 좌표는 기존대로 job_work_locations 한 곳에만 둔다. 게시자가 등록/관리 화면에서 지도에 직접
--   찍은 핀은 location_verified=true + verification_method='poster_pin' 으로 저장해 "어떻게 확인됐는지"를
--   구분한다(기존 확인 행은 verification_method NULL — 추정 backfill 안 함).
-- - 게스트(비로그인) 공고는 job_work_locations에 직접 쓸 권한이 없으므로, 소유 확인(로그인 고용주
--   본인 또는 게스트 관리 토큰)을 함수 안에서 하는 SECURITY DEFINER RPC로만 핀·조건을 바꾼다.
--   크롤링 공고(employer_id NULL + 토큰 NULL)는 이 RPC로 바꿀 수 없다.

begin;

-- 1) 근무조건 컬럼 ------------------------------------------------------------
alter table public.local_jobs
  add column if not exists shuttle_bus boolean,
  add column if not exists dormitory boolean,
  add column if not exists meal_provided boolean,
  add column if not exists immediate_start boolean,
  add column if not exists recruitment_type text,
  add column if not exists work_schedule text,
  add column if not exists weekend_work boolean;

alter table public.local_jobs
  add constraint local_jobs_recruitment_type_check
    check (recruitment_type is null or recruitment_type in ('direct', 'agency', 'unknown')),
  add constraint local_jobs_work_schedule_check
    check (work_schedule is null or work_schedule in ('5_days', '6_days', 'other'));

comment on column public.local_jobs.shuttle_bus is '통근버스 제공: true 있음 / false 없음 / NULL 정보 미확인';
comment on column public.local_jobs.dormitory is '기숙사 제공: true / false / NULL 미확인';
comment on column public.local_jobs.meal_provided is '식사 제공: true / false / NULL 미확인';
comment on column public.local_jobs.immediate_start is '즉시 출근 가능: true / false / NULL 미확인';
comment on column public.local_jobs.recruitment_type is '채용 형태: direct 직접채용 / agency 도급·인력업체 / unknown 확인했으나 불명확 / NULL 미분류. employer_id 유무로 추정하지 않는다';
comment on column public.local_jobs.work_schedule is '근무 일정: 5_days / 6_days / other / NULL 미확인';
comment on column public.local_jobs.weekend_work is '주말 근무: true / false / NULL 미확인';

-- 로그인 고용주는 기존처럼 컬럼 단위 UPDATE 권한으로 자기 공고를 고칠 수 있게 한다(RLS local_jobs_employer_update 적용).
grant update (shift_type, shuttle_bus, dormitory, meal_provided, immediate_start, recruitment_type, work_schedule, weekend_work)
  on public.local_jobs to authenticated;

-- 2) 근무지 좌표 확인 방식 ------------------------------------------------------
alter table public.job_work_locations
  add column if not exists verification_method text;

alter table public.job_work_locations
  add constraint job_work_locations_verification_method_check
    check (verification_method is null or verification_method in ('source_coordinate', 'admin_approved', 'poster_pin'));

comment on column public.job_work_locations.verification_method is
  'location_verified=true 의 근거: source_coordinate 원문 좌표 대조 / admin_approved 관리자 확인 / poster_pin 게시자가 지도에 직접 지정 / NULL 기존 행(미기록)';

-- 3) 소유 확인 헬퍼 -------------------------------------------------------------
create or replace function public.can_manage_local_job(p_job_id bigint, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.local_jobs l
    where l.id = p_job_id
      and (
        (auth.uid() is not null and l.employer_id = auth.uid() and public.is_account_active(auth.uid()))
        or (l.employer_id is null and l.guest_manage_token is not null
            and p_token is not null and length(p_token) >= 20 and l.guest_manage_token = p_token)
      )
  );
$$;
revoke all on function public.can_manage_local_job(bigint, text) from public, anon, authenticated;

-- 4) 게시자 핀 저장/해제 ----------------------------------------------------------
create or replace function public.set_job_pinned_location(
  p_job_id bigint,
  p_token text,
  p_address text,
  p_lat double precision,
  p_lng double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_local_job(p_job_id, p_token) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.job_work_locations
  where job_id = p_job_id and verification_method = 'poster_pin';

  if p_lat is null or p_lng is null then
    return true;  -- 핀 해제
  end if;
  -- 베트남 범위 밖 좌표 거부(오입력 방지)
  if p_lat < 8 or p_lat > 24 or p_lng < 102 or p_lng > 110 then
    raise exception 'coordinates out of range' using errcode = '22023';
  end if;

  insert into public.job_work_locations (
    job_id, raw_address, lat, lng, geocode_status, geocode_source, location_verified,
    verification_method, sort_order, address_accuracy, coordinate_accuracy
  ) values (
    p_job_id, coalesce(nullif(btrim(p_address), ''), 'Vị trí do nhà tuyển dụng chọn trên bản đồ'),
    p_lat, p_lng, 'manual', 'poster_pin', true,
    'poster_pin', 0, 'exact_text', 'exact'
  );
  return true;
end;
$$;
revoke all on function public.set_job_pinned_location(bigint, text, text, double precision, double precision) from public;
grant execute on function public.set_job_pinned_location(bigint, text, text, double precision, double precision) to anon, authenticated;

-- 5) 근무조건 정확히 설정(NULL 로 되돌리기 포함) ---------------------------------
create or replace function public.update_job_conditions(
  p_job_id bigint,
  p_token text,
  p_shift_type text,
  p_shuttle_bus boolean,
  p_dormitory boolean,
  p_meal_provided boolean,
  p_recruitment_type text,
  p_immediate_start boolean,
  p_work_schedule text,
  p_weekend_work boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_local_job(p_job_id, p_token) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.local_jobs set
    shift_type = p_shift_type,
    shuttle_bus = p_shuttle_bus,
    dormitory = p_dormitory,
    meal_provided = p_meal_provided,
    recruitment_type = p_recruitment_type,
    immediate_start = p_immediate_start,
    work_schedule = p_work_schedule,
    weekend_work = p_weekend_work
  where id = p_job_id;
  return found;
end;
$$;
revoke all on function public.update_job_conditions(bigint, text, text, boolean, boolean, boolean, text, boolean, text, boolean) from public;
grant execute on function public.update_job_conditions(bigint, text, text, boolean, boolean, boolean, text, boolean, text, boolean) to anon, authenticated;

-- 6) 관리 화면용 조회(숨김·비활성 공고도 소유자는 읽을 수 있어야 함) -------------------
create or replace function public.get_job_conditions(p_job_id bigint, p_token text)
returns table (
  shift_type text,
  shuttle_bus boolean,
  dormitory boolean,
  meal_provided boolean,
  recruitment_type text,
  immediate_start boolean,
  work_schedule text,
  weekend_work boolean,
  urgent boolean,
  pin_address text,
  pin_lat double precision,
  pin_lng double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_local_job(p_job_id, p_token) then
    return;
  end if;
  return query
  select l.shift_type, l.shuttle_bus, l.dormitory, l.meal_provided, l.recruitment_type,
         l.immediate_start, l.work_schedule, l.weekend_work, l.urgent,
         w.raw_address, w.lat, w.lng
  from public.local_jobs l
  left join lateral (
    select raw_address, lat, lng from public.job_work_locations
    where job_id = l.id and verification_method = 'poster_pin'
    order by id desc limit 1
  ) w on true
  where l.id = p_job_id;
end;
$$;
revoke all on function public.get_job_conditions(bigint, text) from public;
grant execute on function public.get_job_conditions(bigint, text) to anon, authenticated;

commit;

-- 표준 근무지 주소 파이프라인(classify -> geocode/검증 -> 지원경로 확인 -> 공개 게이트)의
-- 판정 근거를 영구 보존하기 위한 추가 컬럼 + 원자적 교체용 RPC.
-- 순수 additive(nullable 컬럼 추가, 함수 신규 정의)이며 기존 컬럼/제약/RLS/데이터를
-- 변경하지 않는다. 검토용으로만 작성 — 사용자 승인 전에는 운영 DB에 실행하지 않는다.

begin;

-- ── 1. job_work_locations: 주소 판정 근거 ────────────────────────
alter table public.job_work_locations
  add column if not exists address_accuracy text
    check (address_accuracy in ('exact', 'region_only', 'undetermined')),
  add column if not exists address_evidence text;

comment on column public.job_work_locations.address_accuracy is
  'classify_work_location_candidate()의 분류 결과. job_work_locations에는 exact만 저장되므로 사실상 항상 exact — 감사/디버깅용 기록.';
comment on column public.job_work_locations.address_evidence is
  '이 좌표를 채택한 근거(예: 기대 지역 일치 여부, confidence 값) — 짧은 사람이 읽을 수 있는 텍스트.';

-- ── 2. local_jobs: 파이프라인 실행 이력 ──────────────────────────
alter table public.local_jobs
  add column if not exists crawler_version text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists publish_gate_reason text
    check (publish_gate_reason in ('ok', 'no_exact_address', 'no_application_path') or publish_gate_reason is null);

comment on column public.local_jobs.crawler_version is
  '이 공고를 마지막으로 처리한 크롤러 파이프라인 버전(job_quality.CRAWLER_VERSION).';
comment on column public.local_jobs.last_verified_at is
  '표준 파이프라인(주소 분류/geocode/지원경로/공개게이트)이 이 공고를 마지막으로 재평가한 시각.';
comment on column public.local_jobs.publish_gate_reason is
  'gate_auto_publish()의 판정 사유. active=false인 크롤러 출처 공고는 반드시 이 값이 채워져 있어야 한다(왜 보류됐는지 추적 가능하도록).';

-- ── 3. job_work_locations 원자적 교체 RPC ────────────────────────
-- 기존 delete()+insert()를 별도 두 요청으로 하면, delete 성공 후 insert가
-- 실패(제약 위반/네트워크 등)할 때 그 공고의 근무지 데이터가 통째로 사라진
-- 채로 남는다. plpgsql 함수 본문은 호출자의 단일 트랜잭션 안에서 실행되므로,
-- 이 함수 안에서 delete+insert를 하면 실패 시 delete까지 함께 롤백된다.
-- p_rows가 빈 배열이면 "이번 판정 결과 정확한 주소가 없다"는 의미로, 기존
-- 행을 지우고 0건으로 만드는 것도 유효한 명시적 호출이다 — 다만 호출부
-- (crawl_topcv.py)는 geocode API 자체가 실패했을 때는 이 함수를 아예
-- 호출하지 않고 기존 데이터를 그대로 둔다(별도 애플리케이션 레벨 가드).
create or replace function public.replace_job_work_locations(
  p_job_id bigint,
  p_rows jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origin text;
begin
  -- 방어적 검증: 이 RPC는 크롤러 파이프라인 전용이다. service_role만 실행
  -- 가능하지만(GRANT), 크롤러 코드 쪽 버그로 잘못된 job_id가 넘어오더라도
  -- 기업이 직접 등록한 공고(origin != 'crawler')의 근무지 데이터를 절대
  -- 건드리지 않도록 함수 내부에서도 한 번 더 확인한다.
  select origin into v_origin from public.local_jobs where id = p_job_id;

  if v_origin is null then
    raise exception 'replace_job_work_locations: local_jobs id % not found', p_job_id;
  end if;

  if v_origin <> 'crawler' then
    raise exception
      'replace_job_work_locations: local_jobs id % has origin=% (not crawler) — refusing to modify its job_work_locations',
      p_job_id, v_origin;
  end if;

  delete from public.job_work_locations where job_id = p_job_id;

  insert into public.job_work_locations (
    job_id, raw_address, normalized_address, lat, lng,
    geocode_status, geocode_source, address_accuracy, address_evidence, sort_order
  )
  select
    p_job_id,
    (r->>'raw_address'),
    (r->>'normalized_address'),
    (r->>'lat')::double precision,
    (r->>'lng')::double precision,
    coalesce(r->>'geocode_status', 'success'),
    (r->>'geocode_source'),
    coalesce(r->>'address_accuracy', 'exact'),
    (r->>'address_evidence'),
    coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

-- service_role(크롤러)만 호출한다 — 다른 role에는 굳이 권한을 열어주지 않는다.
revoke all on function public.replace_job_work_locations(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_job_work_locations(bigint, jsonb) to service_role;

commit;

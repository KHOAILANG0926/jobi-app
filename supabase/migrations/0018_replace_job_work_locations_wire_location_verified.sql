-- 적용됨(APPLIED) — 2026-09-05, 사용자 승인 후 운영 DB(edhuesdnuxlbcfephutq)에
-- 실행 완료. Supabase 마이그레이션 이력에
-- replace_job_work_locations_wire_location_verified로 기록됨. 적용 전후
-- 검증 결과는 MIGRATION_0018_APPLIED.md 참고.
--
-- 배경(2026-09-04, 사용자 지시 — 코드·DB 호환성 전수 확인 중 발견):
-- job_work_locations.location_verified 컬럼은 migration 0010에서 이미
-- 만들어졌고(boolean not null default false) 운영 DB에 존재했지만,
-- replace_job_work_locations() RPC(migration 0015)의 INSERT 문 컬럼 목록에
-- 이 컬럼이 아예 빠져 있어 크롤러가 쓴 모든 행이 영원히 기본값 false로
-- 남았다 — 실제로는 좌표가 exact/ward로 확인된 행도 location_verified만
-- 보면 검증 안 된 것처럼 보였다.
--
-- 개념적으로 이 컬럼은 크롤러 파이프라인의 새 source_verified 값(원문
-- 제공 좌표로 실제 확인됐는지, crawler/geocode.py의
-- source_coordinate_matches_location() 참고)과 정확히 대응한다 — 이
-- migration은 그 값을 실제로 DB에 저장하도록 RPC만 갱신했다(테이블 구조
-- 변경 없음, 컬럼은 이미 있었음).
--
-- 추가 배경(2026-09-04, 같은 날 후속 지시 — 반복주소 수정): 같은 물리적
-- 근무지가 모집지역 접미사만 다르게 붙어 여러 번 나열되는 경우(실측: KCN
-- Hiệp Phước 공고 — "...Bình Chánh"/"...Quận 7"/"...Cần Giuộc" 3개 변형이
-- 전부 같은 산업단지, geocode 결과가 최대 ~15km까지 갈라짐)를 크롤러가
-- geocode 이전에 하나의 근무구역으로 묶도록 고쳤다(crawl_topcv.py의
-- _group_candidates_by_core_location() 참고) — 이제 좌표는 근무구역당 1개만
-- 만든다.
--
-- 정정 배경(2026-09-04, 세 번째 지시 — "recruitment_regions 저장 위치
-- 확인"): 모집지역 배열을 두 레벨로 명확히 분리한다:
--   * local_jobs.recruitment_regions        — 공고 "전체"가 밝힌 모집지역
--     라벨 전부. work_locations 원본 후보 전체 기준이라 job_work_locations
--     행이 0건이어도 절대 사라지지 않는다(crawl_topcv.py의
--     _compute_job_recruitment_regions() 참고).
--   * job_work_locations.matched_recruitment_regions — 그 중 "이 특정
--     근무구역 1곳"에 실제로 매칭된 라벨의 부분집합만(resolve_work_locations()
--     참고).
-- "미확인 지역"(공고는 모집한다고 밝혔지만 특정 근무지에 매칭되지 않은 지역)은
-- 별도 컬럼으로 저장하지 않는다 — local_jobs.recruitment_regions에서
-- job_work_locations.matched_recruitment_regions 합집합을 뺀 차집합으로
-- 필요할 때 계산한다(중복 저장으로 인한 데이터 불일치 방지).
--
-- local_jobs.recruitment_regions는 job_work_locations RPC와 무관하게
-- upsert_job_record()가 local_jobs에 직접 insert/update하는 값이다.
-- 2026-09-05, 이 migration 적용 직후 crawler/job_quality.py의
-- UPDATE_TRACKED_FIELDS + crawl_topcv.py의 build_job_record()를 함께
-- 활성화해(job["recruitment_regions"] 실제 컬럼 키로 채움) 실제로
-- 저장되기 시작했다.
--
-- RLS 재검토: 이 migration은 local_jobs/job_work_locations의 RLS 정책을
-- 전혀 건드리지 않는다(migration 0019가 별도로 관리) — 적용 직후 두 SELECT
-- 정책(local_jobs_public_select/job_work_locations_public_select)이
-- local_job_is_visible() 기반으로 그대로 유지됨을 재확인했다.

begin;

alter table public.local_jobs
  add column if not exists recruitment_regions text[];

comment on column public.local_jobs.recruitment_regions is
  '이 공고 전체가 모집한다고 밝힌 지역 라벨 전부(예: {"TP.HCM","Long An"}) — "Địa điểm làm việc" 섹션의 원본 후보 전체 기준(job_work_locations 행이 0건이어도 보존됨). 특정 근무구역에 매칭된 부분집합은 job_work_locations.matched_recruitment_regions를 본다.';

alter table public.job_work_locations
  add column if not exists matched_recruitment_regions text[];

comment on column public.job_work_locations.matched_recruitment_regions is
  '이 근무구역(1개의 물리적 장소)에 실제로 매칭된 모집지역 라벨의 부분집합(예: {"TP.HCM","Long An"}) — 크롤러가 geocode 이전에 같은 핵심 주소(모집지역 접미사만 다름)를 하나로 묶어 좌표 복제 없이 채운다. 공고 전체 모집지역은 local_jobs.recruitment_regions를 본다. 단일 지역 공고는 원소 1개짜리 배열.';

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
    geocode_status, geocode_source, address_accuracy, coordinate_accuracy, address_evidence,
    location_verified, matched_recruitment_regions, sort_order
  )
  select
    p_job_id,
    (r->>'raw_address'),
    (r->>'normalized_address'),
    (r->>'lat')::double precision,
    (r->>'lng')::double precision,
    coalesce(r->>'geocode_status', 'success'),
    (r->>'geocode_source'),
    coalesce(r->>'address_accuracy', 'exact_text'),
    (r->>'coordinate_accuracy'),
    (r->>'address_evidence'),
    coalesce((r->>'location_verified')::boolean, false),
    coalesce(
      (
        select array_agg(x) from jsonb_array_elements_text(
          case when jsonb_typeof(r->'matched_recruitment_regions') = 'array'
            then r->'matched_recruitment_regions'
            else '[]'::jsonb
          end
        ) as x
      ),
      '{}'
    ),
    coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

revoke all on function public.replace_job_work_locations(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_job_work_locations(bigint, jsonb) to service_role;

commit;

-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
--
-- 배경(2026-09-04, 사용자 지시 — 코드·DB 호환성 전수 확인 중 발견):
-- job_work_locations.location_verified 컬럼은 migration 0010에서 이미
-- 만들어졌고(boolean not null default false) 지금도 운영 DB에 존재하지만,
-- replace_job_work_locations() RPC(migration 0015)의 INSERT 문 컬럼 목록에
-- 이 컬럼이 아예 빠져 있어 크롤러가 쓴 모든 행이 영원히 기본값 false로
-- 남는다 — 실제로는 좌표가 exact/ward로 확인된 행도 location_verified만
-- 보면 검증 안 된 것처럼 보인다.
--
-- 개념적으로 이 컬럼은 크롤러 파이프라인의 새 source_verified 값(원문
-- 제공 좌표로 실제 확인됐는지, crawler/geocode.py의
-- source_coordinate_matches_location() 참고)과 정확히 대응한다 — 이번
-- migration은 그 값을 실제로 DB에 저장하도록 RPC만 갱신한다(테이블 구조
-- 변경 없음, 컬럼은 이미 있음). crawl_topcv.py의
-- _work_location_rpc_rows()는 이미 이 payload 키를 포함해 보내고 있지만
-- (하위 호환 — 이 migration 실행 전에는 RPC가 그냥 무시함), 이 migration을
-- 실행해야 실제로 저장되기 시작한다.

begin;

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
    location_verified, sort_order
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
    coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

commit;

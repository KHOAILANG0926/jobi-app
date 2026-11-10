-- Lee 2026-11-09 "Google 호출 전에 기존 회사·사업장 DB를 조회 … 회사명이 같아도 지점이 다르면 잘못 합치지 마세요", 2026-11-10 2단계.
-- 새 공고 위치 확인(precheck)이 Google에 묻기 전에 우리가 확정한 위치(관리자 확정 기억표)를 먼저 본다. 읽기만 한다.
-- 조건은 등록 뒤 자동 재사용(location_private.valid_memory_targets, 20261026231445)과 같다: 같은 회사 이름 + 같은 주소 글자 열쇠일 때만.
-- 그래서 여기서 맞으면 등록 직후 같은 확정 위치가 자동으로 붙고(trg_01_canonical_job_identity → reconcile_company), 다른 지점·비슷한 주소는 맞지 않는다.
-- 표·권한 구조 변경 없음(함수 하나, service_role만 실행).
create or replace function public.location_memory_point(p_company text, p_addresses text[])
returns table(address text, candidate_id bigint, lat double precision, lng double precision, place_precision text)
language sql stable security definer set search_path = pg_catalog, public as $$
 select distinct on (a.address) a.address, c.id, c.lat, c.lng, c.place_precision
 from unnest(coalesce(p_addresses, '{}'::text[])) a(address)
 join public.job_location_candidates c
  on location_private.company_identity(c.company_snapshot) = location_private.company_identity(p_company)
 and public.admin_location_key(c.address_snapshot) = public.admin_location_key(a.address)
 join public.admin_confirmed_location_memory m on m.source_candidate_id = c.id and m.active
 join public.local_jobs origin_job on origin_job.id = c.job_id
 where nullif(btrim(p_company), '') is not null and nullif(public.admin_location_key(a.address), '') is not null
 and c.status = 'approved' and c.reviewed_by is not null and c.reviewed_at is not null
 and c.evidence not like 'AUTO REUSE:%'
 and c.place_precision in ('entrance', 'building', 'site') and nullif(btrim(c.evidence), '') is not null
 and c.lat between 8 and 24 and c.lng between 102 and 110
 and m.approved_by = c.reviewed_by and m.approved_at = c.reviewed_at and m.lat = c.lat and m.lng = c.lng and m.place_precision = c.place_precision
 and m.address_key = public.admin_location_key(c.address_snapshot)
 and location_private.company_identity(origin_job.company) = location_private.company_identity(c.company_snapshot)
 and (public.admin_location_key(origin_job.location) = public.admin_location_key(c.address_snapshot)
  or exists(select 1 from public.job_work_locations ow where ow.job_id = origin_job.id
   and public.admin_location_key(ow.raw_address) = public.admin_location_key(c.address_snapshot)))
 order by a.address, c.reviewed_at desc, c.id desc
$$;
revoke all on function public.location_memory_point(text, text[]) from public, anon, authenticated;
grant execute on function public.location_memory_point(text, text[]) to service_role;

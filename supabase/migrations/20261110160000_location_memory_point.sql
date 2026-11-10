-- Lee 2026-11-09 "Google 호출 전에 기존 회사·사업장 DB를 조회 … 회사명이 같아도 지점이 다르면 잘못 합치지 마세요", 2026-11-10 2단계.
-- 새 공고 위치 확인(precheck)이 Google에 묻기 전에 우리가 확정한 위치(관리자 확정 기억표)를 먼저 본다. 읽기만 한다.
-- 재사용 자격(승인·기억 활성·정밀도·좌표 범위·원 공고 일치)은 한 곳(location_private.eligible_memory)에만 둔다:
--  등록 뒤 자동 재사용(location_private.valid_memory_targets, 20261026231445)과 위치 확인 조회가 같은 자격을 읽는다(Codex #634 P1).
-- 맞추는 열쇠는 같은 회사 이름(company_identity) + 같은 주소 글자 열쇠(admin_location_key)뿐 — 다른 지점·비슷한 주소는 맞지 않는다.
-- valid_memory_targets의 칸·결과는 예전과 같다(정의만 자격 view를 읽도록). 표·권한 구조 변경 없음.
create view location_private.eligible_memory with (security_invoker = true) as
 select location_private.company_identity(c.company_snapshot) company_identity,
  public.admin_location_key(c.address_snapshot) address_key,
  c.id source_candidate_id, c.lat, c.lng, c.place_precision, c.reviewed_at approved_at, c.reviewed_by approved_by
 from public.job_location_candidates c
 join public.admin_confirmed_location_memory m on m.source_candidate_id = c.id and m.active
 join public.local_jobs origin_job on origin_job.id = c.job_id
 where c.status = 'approved' and c.reviewed_by is not null and c.reviewed_at is not null
 and c.evidence not like 'AUTO REUSE:%'
 and c.place_precision in ('entrance', 'building', 'site') and nullif(btrim(c.evidence), '') is not null
 and c.lat between 8 and 24 and c.lng between 102 and 110
 and m.approved_by = c.reviewed_by and m.approved_at = c.reviewed_at and m.lat = c.lat and m.lng = c.lng and m.place_precision = c.place_precision
 and m.address_key = public.admin_location_key(c.address_snapshot)
 and location_private.company_identity(origin_job.company) = location_private.company_identity(c.company_snapshot)
 and (public.admin_location_key(origin_job.location) = public.admin_location_key(c.address_snapshot)
  or exists(select 1 from public.job_work_locations ow where ow.job_id = origin_job.id
   and public.admin_location_key(ow.raw_address) = public.admin_location_key(c.address_snapshot)));

create or replace view location_private.valid_memory_targets with (security_invoker = true) as
with targets as (
 select j.id job_id, j.company, w.raw_address address, w.id work_location_id from public.local_jobs j
 join public.job_work_locations w on w.job_id = j.id
 union all select j.id, j.company, j.location, null::bigint from public.local_jobs j
 where nullif(btrim(j.location), '') is not null and not exists(select 1 from public.job_work_locations w where w.job_id = j.id)
), eligible as (
 select t.*, e.source_candidate_id, e.lat, e.lng, e.place_precision, e.approved_at, e.approved_by,
 row_number() over(partition by t.job_id, public.admin_location_key(t.address) order by e.approved_at desc, e.source_candidate_id desc) preference
 from targets t join location_private.eligible_memory e
 on e.company_identity = location_private.company_identity(t.company)
 and e.address_key = public.admin_location_key(t.address)
)
select * from eligible where preference = 1;

create or replace function public.location_memory_point(p_company text, p_addresses text[])
returns table(address text, candidate_id bigint, lat double precision, lng double precision, place_precision text)
language sql stable security definer set search_path = pg_catalog, public as $$
 select distinct on (a.address) a.address, e.source_candidate_id, e.lat, e.lng, e.place_precision
 from unnest(coalesce(p_addresses, '{}'::text[])) a(address)
 join location_private.eligible_memory e
  on e.company_identity = location_private.company_identity(p_company)
 and e.address_key = public.admin_location_key(a.address)
 where nullif(btrim(p_company), '') is not null and nullif(public.admin_location_key(a.address), '') is not null
 order by a.address, e.approved_at desc, e.source_candidate_id desc
$$;
revoke all on location_private.eligible_memory from public, anon, authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname = 'location_writer') then
  grant select on location_private.eligible_memory to location_writer;
 end if;
end $$;
revoke all on function public.location_memory_point(text, text[]) from public, anon, authenticated;
grant execute on function public.location_memory_point(text, text[]) to service_role;

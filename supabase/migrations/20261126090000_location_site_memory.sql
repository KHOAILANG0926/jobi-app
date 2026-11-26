-- Lee 2026-11-26 "같은 공장을 다시 묻지 않게", "진행하자": 우리 사업장 위치 기억.
-- 같은 회사 + 같은 사업장에 이미 확정된 좌표(Google·VietMap·관리자 확정)가 있으면 위치 확인이 Google·VietMap·Goong을 다시 부르지 않고 그 좌표를 쓴다.
--  · 기억의 원본은 새 표가 아니라 기존 위치 원본(job_work_locations) — 확정 줄(point_kind='exact', location_verified)만 읽는다. 대략 위치(gate·area)는 읽지 않는다.
--  · 같은 회사 = 기존 회사 열쇠(company_identity) 또는 표기만 다름(admin_location_key, W6과 같은 기준).
--  · 같은 사업장 = 20261124150000의 판정 한 곳(location_private.same_site_address): 성조·대소문자·문장부호·띄어쓰기, 뒤에 붙은 지역 이름만 다르면 같다.
--    번지·로트·공단 번호·'mở rộng'이 다르면 다른 곳(다른 지점 병합 금지 그대로).
--  · 읽기만 한다. 기존 좌표·핀·출처는 바꾸지 않는다. 여러 줄이 서로 다른 곳을 가리키면 위치 확인 쪽(agreedSiteMemory)이 쓰지 않는다.
--  · 관리자 확정 기억표(location_memory_point)·Google 결과 저장(research_artifacts)은 그대로 둔다.
begin;
do $guard$ begin
 if to_regprocedure('location_private.same_site_address(text,text,text[])') is null then raise exception 'site memory: same_site_address missing'; end if;
 if to_regprocedure('location_private.company_identity(text)') is null then raise exception 'site memory: company_identity missing'; end if;
end$guard$;

create or replace function public.location_site_memory(p_company text, p_address text)
returns table(lat double precision, lng double precision, source text, work_location_id bigint, job_id bigint)
language sql stable security definer set search_path = pg_catalog, public as $$
 select w.lat, w.lng,
  case when w.point_authority = 'admin_confirmed' then 'admin_approved'
   else coalesce(nullif(btrim(w.point_evidence->>'source'), ''), w.point_authority) end,
  w.id, w.job_id
 from public.job_work_locations w
 join public.local_jobs j on j.id = w.job_id
 where nullif(public.admin_location_key(p_company), '') is not null
  and nullif(public.admin_location_key(p_address), '') is not null
  and (location_private.company_identity(j.company) = location_private.company_identity(p_company)
   or public.admin_location_key(j.company) = public.admin_location_key(p_company))
  and w.point_kind = 'exact' and w.location_verified
  and w.point_authority in ('source_verified', 'admin_confirmed', 'auto_reuse')
  and w.lat between 8 and 24 and w.lng between 102 and 110
  and location_private.same_site_address(w.raw_address, p_address,
   array[w.province, w.district, w.ward, w.resolved_province] || coalesce(w.resolved_wards, '{}'::text[]))
 order by w.updated_at desc nulls last, w.id desc
 limit 20
$$;
revoke all on function public.location_site_memory(text, text) from public, anon, authenticated;
grant execute on function public.location_site_memory(text, text) to service_role;
commit;

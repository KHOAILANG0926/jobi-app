-- 중복 판정 정확한 점 기준을 화면과 맞춤 (Lee 2026-11-07 수평 전개, #5599).
-- 화면(src/lib/jobCoords.ts precise)은 핀 종류 exact + 확인됨(location_verified)일 때만 정확한 위치로 본다.
-- 중복 판정은 exact면 확인 여부와 상관없이 정확한 점으로 봐서, 확인 안 된 점끼리 "확실한 중복"이 될 수 있었다(Lee: 잘못 버려지면 안 됨).
-- 바꾼 뒤: exact+확인됨 · 공단 정문(gate) · 관리자 확정만 정확한 점. 나머지는 위치 애매 → 관리자 게시판.
do $pre$
begin
  if to_regprocedure('dedupe_private.precise_points(bigint)') is null then raise exception 'dedupe: precise_points 없음(4단계 먼저)'; end if;
end $pre$;

create or replace function dedupe_private.precise_points(p_job bigint) returns table(lat double precision, lng double precision)
language sql stable set search_path = pg_catalog, public as $$
  select w.lat, w.lng from public.job_work_locations w
   where w.job_id = p_job and w.lat is not null and w.lng is not null
     and ((w.point_kind = 'exact' and w.location_verified) or w.point_kind = 'gate' or w.point_authority = 'admin_confirmed')
$$;
revoke all on function dedupe_private.precise_points(bigint) from public, anon, authenticated;

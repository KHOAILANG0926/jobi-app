-- Google 결과 저장 30일 정리(Lee 2026-11-09 "Google 결과 저장 방식이 약관에 맞는지 확인하고 필요한 부분만 수정").
-- Google Maps Platform 서비스 약관 14.3: Places API 좌표는 최대 30일까지 임시 저장, 그 뒤 삭제. 장소 번호(place_id)는 계속 저장 가능(A.3).
-- 위치 확인 저장소(research_artifacts kind map-r1-query)의 Google 결과(Text Search {places}, Place Details {websiteUri}) 중
-- 저장 시각(cachedAt, 없으면 줄 만든 시각)이 30일 지난 것은 장소 번호만 남기고 나머지를 비운다. 줄은 지우지 않는다(expired 표시).
-- VietMap·Goong 결과와 다른 kind는 건드리지 않는다. 읽는 쪽(googleFresh)은 expired·30일 지난 결과를 쓰지 않고 다시 묻는다.
-- 정기 검사(job-ocr-check)가 서버 키로만 부른다(외부 실행 불가). Codex #619 P0: 운영 쓰기는 migration으로 설치한 함수로만.
do $pre$
begin
  if to_regclass('public.research_artifacts') is null then raise exception 'google cache expire: 저장소 표 없음'; end if;
  if to_regprocedure('public.google_cache_expire(integer)') is not null then raise exception 'google cache expire: 이미 적용됨'; end if;
end $pre$;

create function public.google_cache_expire(p_limit integer default 2000) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  with old as (
    select a.id from public.research_artifacts a
     where a.kind = 'map-r1-query'
       and jsonb_typeof(a.payload->'data') = 'object'
       and (jsonb_typeof(a.payload->'data'->'places') = 'array' or (a.payload->'data') ? 'websiteUri')
       and coalesce(a.payload->'data'->>'expired', 'false') <> 'true'
       and coalesce((a.payload->'data'->>'cachedAt')::timestamptz, a.created_at) < now() - interval '30 days'
     order by a.id
     limit greatest(1, least(coalesce(p_limit, 2000), 5000))
  )
  update public.research_artifacts a
     set payload = jsonb_build_object('data', jsonb_build_object(
           'expired', true,
           'expiredAt', now(),
           'places', coalesce((select jsonb_agg(jsonb_build_object('id', p->>'id'))
                                 from jsonb_array_elements(case when jsonb_typeof(a.payload->'data'->'places') = 'array'
                                                                then a.payload->'data'->'places' else '[]'::jsonb end) p
                                where p ? 'id'), '[]'::jsonb)))
    from old where a.id = old.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.google_cache_expire(integer) from public, anon, authenticated;
grant execute on function public.google_cache_expire(integer) to service_role;
comment on function public.google_cache_expire(integer) is 'Google 결과 30일 정리(약관 14.3) — 장소 번호만 남김, 줄 삭제 없음. 서버 키만.';

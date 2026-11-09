-- 30일 지난 Google 결과만 장소 번호로 줄이고, 나머지(VietMap·Goong·다른 kind·30일 안·이미 정리됨)는 그대로. 줄 수는 그대로.
do $t$
declare n integer; before integer;
begin
  delete from public.research_artifacts where name like 'gce-%';
  insert into public.research_artifacts(kind, name, payload, created_at) values
   ('map-r1-query','gce-legacy','{"data":{"places":[{"id":"ChIJa","displayName":{"text":"A"},"location":{"latitude":1,"longitude":2}}]}}', now()-interval '40 days'),
   ('map-r1-query','gce-stamp-old','{"data":{"places":[{"id":"ChIJb","location":{"latitude":1,"longitude":2}}],"cachedAt":"2026-01-01T00:00:00Z"}}', now()),
   ('map-r1-query','gce-stamp-fresh','{"data":{"places":[{"id":"ChIJc","location":{"latitude":1,"longitude":2}}],"cachedAt":"2999-01-01T00:00:00Z"}}', now()-interval '90 days'),
   ('map-r1-query','gce-web-old','{"data":{"websiteUri":"https://x.vn","cachedAt":"2026-01-01T00:00:00Z"}}', now()),
   ('map-r1-query','gce-vietmap','{"data":[{"ref_id":"v","lat":1}]}', now()-interval '400 days'),
   ('map-r1-query','gce-goong','{"data":{"predictions":[]}}', now()-interval '400 days'),
   ('autolocate','gce-ward','{"data":{"places":[{"id":"w","location":{}}]}}', now()-interval '400 days');
  select count(*) into before from public.research_artifacts;
  n := public.google_cache_expire(2000);
  if n <> 3 then raise exception '정리 건수 %(3이어야 함)', n; end if;
  if public.google_cache_expire(2000) <> 0 then raise exception '두 번째 실행은 0건이어야 함'; end if;
  if (select count(*) from public.research_artifacts) <> before then raise exception '줄이 지워짐'; end if;
  if (select payload from public.research_artifacts where name = 'gce-legacy') <> jsonb_build_object('data', jsonb_build_object('expired', true, 'expiredAt', (select payload->'data'->'expiredAt' from public.research_artifacts where name = 'gce-legacy'), 'places', '[{"id":"ChIJa"}]'::jsonb)) then
    raise exception '장소 번호만 남아야 함';
  end if;
  if (select payload->'data'->'places'->0 ? 'location' from public.research_artifacts where name = 'gce-stamp-fresh') is not true then raise exception '30일 안 결과가 지워짐'; end if;
  if (select payload->'data'->0->>'ref_id' from public.research_artifacts where name = 'gce-vietmap') <> 'v'
     or (select payload->'data' ? 'predictions' from public.research_artifacts where name = 'gce-goong') is not true
     or (select payload->'data'->'places'->0 ? 'location' from public.research_artifacts where name = 'gce-ward') is not true then
    raise exception 'Google 아닌 결과를 건드림';
  end if;
  delete from public.research_artifacts where name like 'gce-%';
  raise notice 'google cache expire CI cases passed';
end $t$;

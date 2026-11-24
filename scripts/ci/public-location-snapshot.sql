-- 3순위 2차: 격리 DB(migration-postgres 폐기용 DB)에서 migration 적용 전후의 공고 공개 상태·위치 원본·위치 보류함을 한 줄씩 찍는다.
-- 읽기만 한다. 시험 DB마다 준비된 표·칸이 달라 표가 있을 때만, 칸은 to_jsonb로 읽는다(없는 칸은 빈 값).
-- 지도 핀이 되는 줄(확정 좌표: exact·gate + 좌표)은 pin, 핀이 안 되는 줄은 nopin — 공개 위치 응답(api/map-locations)과 같은 기준.
\set QUIET on
\pset tuples_only on
\pset format unaligned
select to_regclass('public.local_jobs') is not null as has_jobs,
       to_regclass('public.job_work_locations') is not null as has_points,
       to_regclass('public.research_artifacts') is not null as has_holds \gset
\if :has_jobs
select format('job|%s|%s|%s', j->>'id',
  case when coalesce((j->>'active')::boolean, false) and not coalesce((j->>'admin_hidden')::boolean, false) then 'public' else 'private' end,
  coalesce(j->>'location', ''))
  from (select to_jsonb(t) j from public.local_jobs t) s order by (j->>'id')::bigint;
\endif
\if :has_points
select format('point|%s|%s|%s|%s|%s|%s', w->>'job_id', w->>'id',
  case when w->>'point_kind' in ('exact', 'gate') and w->>'lat' is not null and w->>'lng' is not null then 'pin' else 'nopin' end,
  coalesce(w->>'point_kind', ''), coalesce(w->>'lat', ''), coalesce(w->>'lng', ''))
  from (select to_jsonb(t) w from public.job_work_locations t) s order by (w->>'job_id')::bigint, (w->>'id')::bigint;
\endif
\if :has_holds
select format('hold|%s|%s|%s', coalesce(r->'meta'->>'from_job_id', ''), coalesce(r->'meta'->>'work_location_id', ''), coalesce(r->'meta'->>'status', r->>'status', ''))
  from (select to_jsonb(t) r from public.research_artifacts t) s where r->>'kind' = 'location-hold' order by 1;
\endif

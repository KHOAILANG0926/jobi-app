-- 3순위 2차(화면 연결): 격리 DB에 migration을 적용한 뒤의 공개 공고와 그 위치 원본 줄을 JSON 한 줄로 낸다(읽기만).
-- 기존 격리 화면 검사(scripts/ops/location-canonical-browser-fixtures.mjs, LOCATION_FIXTURE_DIR)가 이 결과를 화면 응답으로 넣는다.
\set QUIET on
\pset tuples_only on
\pset format unaligned
select to_regclass('public.local_jobs') is not null and to_regclass('public.job_work_locations') is not null as has_both \gset
\if :has_both
with jobs as (
  select to_jsonb(t) j from public.local_jobs t
  where coalesce((to_jsonb(t)->>'active')::boolean, false) and not coalesce((to_jsonb(t)->>'admin_hidden')::boolean, false)
)
select jsonb_build_object(
  'jobs', coalesce((select jsonb_agg(j order by (j->>'id')::bigint) from jobs), '[]'),
  'locations', coalesce((select jsonb_agg(to_jsonb(w) order by w.job_id, w.id) from public.job_work_locations w
                         where w.job_id in (select (j->>'id')::bigint from jobs)), '[]'))::text;
\endif

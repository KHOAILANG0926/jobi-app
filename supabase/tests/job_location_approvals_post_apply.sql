-- 20260929120000_job_location_approvals.sql 적용 직후 실제 DB 카탈로그 확인(읽기 전용).
-- Supabase SQL Editor 또는 MCP execute_sql로 실행. 모든 행의 ok가 true여야 한다.
select 'table exists' as check, to_regclass('public.job_location_candidates') is not null as ok
union all select 'RLS enabled', relrowsecurity from pg_class where oid = 'public.job_location_candidates'::regclass
union all select 'public policy = approved + public job only',
  exists (select 1 from pg_policies where tablename = 'job_location_candidates'
          and policyname = 'job_location_candidates_public_approved' and qual like '%approved%' and qual like '%admin_hidden%')
union all select 'anon has NO select on evidence',
  not has_column_privilege('anon', 'public.job_location_candidates', 'evidence', 'select')
union all select 'anon has select on lat',
  has_column_privilege('anon', 'public.job_location_candidates', 'lat', 'select')
union all select 'anon has NO insert', not has_table_privilege('anon', 'public.job_location_candidates', 'insert')
union all select 'authenticated has NO update', not has_table_privilege('authenticated', 'public.job_location_candidates', 'update')
union all select 'area cannot be approved (check constraint)',
  exists (select 1 from pg_constraint where conname = 'job_location_candidates_area_not_approvable')
union all select 'admin RPCs are security definer',
  (select bool_and(prosecdef) from pg_proc where proname in
    ('admin_add_location_candidate', 'admin_review_location_candidate', 'admin_list_location_candidates'))
union all select 'anon cannot execute admin RPCs',
  not has_function_privilege('anon', 'public.admin_review_location_candidate(bigint, text, text)', 'execute');

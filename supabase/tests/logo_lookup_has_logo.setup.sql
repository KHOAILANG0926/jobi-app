-- 20261110092000_logo_lookup_has_logo.sql 시험 DB 준비: 앞선 로고 찾기 migration을 불러 둔다.
\i supabase/tests/logo_lookup_api_limits.setup.sql
select to_regprocedure('public.job_logo_lookup_record(bigint,text,text,text)') is null as need_logo \gset
\if :need_logo
\i supabase/migrations/20261107150000_logo_lookup_api_limits.sql
\endif

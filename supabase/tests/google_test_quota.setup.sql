-- 20261110090000_google_test_quota.sql 시험 DB 준비: 앞선 한도 표 migration을 불러 둔다.
\i supabase/tests/logo_lookup_api_limits.setup.sql
select to_regclass('public.external_api_limits') is null as need_limits \gset
\if :need_limits
\i supabase/migrations/20261107150000_logo_lookup_api_limits.sql
\endif

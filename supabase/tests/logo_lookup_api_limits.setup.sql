-- 20261107150000_logo_lookup_api_limits.sql 시험 DB 준비(예전 check-postgres-migrations.sh 분기에서 옮김, Codex #585 P1).
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
create or replace function public.require_admin() returns uuid language plpgsql as $$ begin raise exception 'not admin'; end $$;
select to_regclass('public.job_brands') is null as need_brands \gset
\if :need_brands
\i supabase/migrations/20260910120000_job_brands_master.sql
\i supabase/migrations/20261101210000_brands_verified_chains.sql
\i supabase/migrations/20261101230000_brand_logo_domains.sql
\i supabase/migrations/20261103190000_brand_categories_restaurant_retail.sql
\endif

-- 브랜드 로고 그림 migration(brand-logo.yml이 만드는 <시각>_brand_logo_<브랜드>.sql) 공통 준비 — 빈 시험 DB에 브랜드 표를 만든다.
-- 예전 check-postgres-migrations.sh의 brand_logo 분기를 이름 규칙 파일로 옮김(2026-11-09, Codex #585 P1).
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
create or replace function public.require_admin() returns uuid language plpgsql as $$ begin raise exception 'not admin'; end $$;
\i supabase/migrations/20260910120000_job_brands_master.sql
\i supabase/migrations/20261101210000_brands_verified_chains.sql
\i supabase/migrations/20261101230000_brand_logo_domains.sql
\i supabase/migrations/20261103190000_brand_categories_restaurant_retail.sql
\i supabase/migrations/20261107180000_brand_logo_image.sql
insert into public.job_brands (name, slug, category, domain, initial, color, active, featured, verified_branches, evidence_url, evidence_note, verified_on)
values ('NETCO POST','netco-post','delivery','netco.com.vn','N','#0a8f3c',true,true,81,'https://netco.com.vn/vi/contact/post-offices','x','2026-11-07')
on conflict (slug) do nothing;

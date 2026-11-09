-- 20261103190000_brand_categories_restaurant_retail.sql 시험 DB 준비 + 적용 전 확인(예전 분기에서 옮김, Codex #585 P1).
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
create or replace function public.require_admin() returns uuid language plpgsql as $$ begin raise exception 'not admin'; end $$;
select to_regclass('public.job_brands') is null as need_brands \gset
\if :need_brands
\i supabase/migrations/20260910120000_job_brands_master.sql
\i supabase/migrations/20261101210000_brands_verified_chains.sql
\i supabase/migrations/20261101230000_brand_logo_domains.sql
\endif
-- 적용 전에는 식당 분류가 거부돼야 한다(시험이 실제 변화를 잡는지).
do $t$ begin
  begin
    insert into public.job_brands(name,slug,category,initial,color) values ('t','ci-restaurant','restaurant','T','#000');
  exception when check_violation then return;
  end;
  raise exception '적용 전인데 restaurant 분류가 허용됨';
end $t$;

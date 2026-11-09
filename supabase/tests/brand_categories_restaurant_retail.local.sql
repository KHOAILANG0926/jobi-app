-- 적용 후: 식당 분류 허용·공장 분류 거부, 로고 도메인 점검 유지(예전 분기에서 옮김, Codex #585 P1).
\i supabase/tests/brand_logo_domains_production_check.sql
do $t$ begin
  begin
    insert into public.job_brands(name,slug,category,initial,color) values ('t','ci-factory','factory','T','#000');
  exception when check_violation then return;
  end;
  raise exception 'factory(공장) 분류가 허용됨';
end $t$;

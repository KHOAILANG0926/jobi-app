-- Read-only: 브랜드 분류에 식당·판매 매장이 있고, JoyThai가 공식 출처·로고 주소와 함께 등록돼 있다.
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
   where conrelid = 'public.job_brands'::regclass and conname = 'job_brands_category_check';
  if def is null or def not like '%restaurant%' or def not like '%retail%' or def not like '%fastfood%' or def not like '%delivery%' then
    raise exception 'brand category check missing restaurant/retail: %', def;
  end if;
  if (select count(*) from public.job_brands where slug = 'joythai' and category = 'restaurant' and domain = 'joythai.vn'
        and active and verified_branches >= 3 and evidence_url like 'https://%' and verified_on is not null) <> 1 then
    raise exception 'joythai brand missing';
  end if;
  if not exists (select 1 from public.job_brand_aliases a join public.job_brands b on b.id = a.brand_id where b.slug = 'joythai' and a.is_primary and a.alias = 'Joy Thái') then
    raise exception 'joythai primary alias missing';
  end if;
  raise notice 'brand_categories_restaurant_retail production check passed';
end $$;

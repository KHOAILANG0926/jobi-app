-- Read-only: 브랜드 업종 검사가 30개 값을 받고, 저장된 브랜드가 모두 그 안에 있다.
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint where conname = 'job_brands_category_check' and conrelid = 'public.job_brands'::regclass;
  if def is null or def not like '%chicken_pizza%' or def not like '%warehouse%' or def not like '%fastfood%' then
    raise exception 'brand category check missing new values: %', def;
  end if;
  if exists (select 1 from public.job_brands where category not in ('restaurant','family_buffet','fastfood','chicken_pizza','cafe','tea_dessert','bakery','beer_pub','lunch_meals','mall','supermarket','convenience','fashion','beauty_pharmacy','phone_electronics','furniture','books_stationery','fuel_carwash','hotel_spa','gym_sports','net_game','amusement','cinema_events','cleaning','repair','education','call_center','finance_insurance','delivery','warehouse')) then
    raise exception 'brand with unknown category';
  end if;
  raise notice 'brand_categories_30 production check passed';
end $$;

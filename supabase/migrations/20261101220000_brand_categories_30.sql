-- 2026-11-01 Lee: 브랜드 업종을 알바몬 "업직종별 브랜드"처럼 30개로(공장 제외). 옛 5개 값은 그대로 포함 — 기존 브랜드 불변.
-- 화면 목록: src/data/brandDirectory.ts BRAND_CATEGORY_GROUPS (같은 30개, 시험이 일치를 확인).
begin;
do $$ begin
  if to_regclass('public.job_brands') is null then raise exception 'brand categories 30: job_brands missing'; end if;
end $$;
alter table public.job_brands drop constraint if exists job_brands_category_check;
alter table public.job_brands add constraint job_brands_category_check check (category in ('restaurant','family_buffet','fastfood','chicken_pizza','cafe','tea_dessert','bakery','beer_pub','lunch_meals','mall','supermarket','convenience','fashion','beauty_pharmacy','phone_electronics','furniture','books_stationery','fuel_carwash','hotel_spa','gym_sports','net_game','amusement','cinema_events','cleaning','repair','education','call_center','finance_insurance','delivery','warehouse'));
commit;

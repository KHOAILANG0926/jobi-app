-- 2026-11-03 Lee "식당이 없는게 말이되?" / "공장이 왜 브랜드야 … 쿠팡같은 물류는 브랜드가 될 수 있어도" → "지적한거 수정해".
-- 브랜드 분류에 식당(restaurant)·판매 매장(retail)을 더한다. 물류는 기존 delivery(Giao hàng / Dịch vụ)에 들어간다. 공장은 브랜드가 아니다.
-- 바뀌는 것은 분류 허용 목록(check)뿐 — 기존 행·칸은 그대로. 이어서 JoyThai(Thai cuisine & hotpot) 브랜드를 공식 출처와 함께 등록한다.
begin;
do $$ begin
  if to_regclass('public.job_brands') is null or to_regclass('public.job_brand_aliases') is null then
    raise exception 'brand categories: job_brands tables missing';
  end if;
  if (select count(*) from pg_constraint where conrelid = 'public.job_brands'::regclass and contype = 'c' and conname = 'job_brands_category_check') <> 1 then
    raise exception 'brand categories: job_brands_category_check not found as expected';
  end if;
end $$;

alter table public.job_brands drop constraint job_brands_category_check;
alter table public.job_brands add constraint job_brands_category_check
  check (category in ('fastfood','restaurant','cafe','bakery','convenience','retail','delivery'));

-- JoyThai: 공식 사이트 joythai.vn, 공식 Facebook 지점 페이지 Bắc Ninh(joythaivn)·Hải Dương(joythaihd)·Vĩnh Phúc(joythaivp) = 3곳(2026-11-03 조회).
-- 공고 #5342 주소 100 Huyền Quang, Bắc Ninh = 시공사 기록(thicongchuoicuahang.com "Nhà Hàng JoyThai Bắc Ninh", 100 Huyền Quang)과 일치.
insert into public.job_brands (name, slug, category, domain, initial, color, active, featured, verified_branches, evidence_url, evidence_note, verified_on) values
  ('JoyThai', 'joythai', 'restaurant', 'joythai.vn', 'J', '#c8102e', true, false, 3,
   'https://joythai.vn/',
   'Facebook chính thức: JoyThai - Thai Cuisine & Hotpot (joythaivn), JoyThai Hải Dương (joythaihd), JoyThai Vĩnh Phúc (joythaivp). Tin #5342: 100 Huyền Quang, Bắc Ninh — trùng công trình "Nhà Hàng JoyThai Bắc Ninh" (thicongchuoicuahang.com).', '2026-11-03')
on conflict (slug) do nothing;

insert into public.job_brand_aliases (brand_id, alias, is_primary)
select b.id, v.alias, v.is_primary from public.job_brands b
join (values ('joythai', 'Joy Thái', true), ('joythai', 'JoyThai', false)) as v(slug, alias, is_primary) on v.slug = b.slug
on conflict (brand_id, alias) do nothing;
commit;

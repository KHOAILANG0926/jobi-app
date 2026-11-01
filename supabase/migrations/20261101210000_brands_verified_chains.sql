-- 2026-11-01 Lee 확정 브랜드 기준: 공식 출처로 지점 3곳 이상 확인된 체인 + 공고의 업체 이름·주소가 실제 매장과 일치.
-- 확인 출처를 브랜드 표에 남긴다(새 칸 4개, 비워 둘 수 있음 — 2026-09 등록된 기존 13개 브랜드는 건드리지 않음).
-- 이번 등록: Highlands Coffee(#5157)·Trung Nguyên Legend(#5231)·Wallace(#5247). 공고 공개·직업 코드 변경 없음.
begin;
do $$ begin
  if to_regclass('public.job_brands') is null or to_regclass('public.job_brand_aliases') is null then
    raise exception 'brands verified chains: job_brands tables missing';
  end if;
end $$;

alter table public.job_brands
  add column if not exists verified_branches integer check (verified_branches is null or verified_branches >= 3),
  add column if not exists evidence_url text,
  add column if not exists evidence_note text,
  add column if not exists verified_on date;
comment on column public.job_brands.verified_branches is '2026-11-01 Lee 기준: 공식 출처로 확인한 지점 수(3 이상만). 기존 2026-09 브랜드는 null(확인 전).';

insert into public.job_brands (name, slug, category, domain, initial, color, active, featured, verified_branches, evidence_url, evidence_note, verified_on) values
  ('Highlands Coffee', 'highlands-coffee', 'cafe', 'highlandscoffee.com.vn', 'H', '#b22830', true, true, 1000,
   'https://tapchicongthuong.vn/highlands-coffee-dat-moc-1-000-cua-hang-tai-viet-nam-525628.htm',
   'Cửa hàng thứ 1.000 khai trương 12/6/2026. Tin #5157: Highlands Coffee Mường Thanh Bắc Ninh, Số 395 Ngô Gia Tự.', '2026-11-01'),
  ('Trung Nguyên Legend', 'trung-nguyen-legend', 'cafe', null, 'T', '#8a5a2b', true, true, 27,
   'https://www.vcci.com.vn/tin-tuc/trung-nguyen-legend-tiep-tuc-phat-trien-manh-me-tren-toan-cau',
   '22 không gian tại Trung Quốc + 5 tại Mỹ (VCCI). Tin #5231: Trung Nguyên Legend 27 Kinh Dương Vương, Vũ Ninh, Bắc Ninh.', '2026-11-01'),
  ('Wallace', 'wallace', 'fastfood', 'wallacevn.com', 'W', '#d71920', true, true, 24,
   'https://wallacevn.com/pages/about-us',
   'Trang chính thức liệt kê 24 cơ sở (gà rán, hamburger). Tin #5247 ghi 216 Nguyễn Trãi Bắc Ninh — trang chính thức ghi CS9 219 Nguyễn Trãi, foody.vn ghi 216 (lệch 1 số, cùng đoạn đường).', '2026-11-01')
on conflict (slug) do nothing;

insert into public.job_brand_aliases (brand_id, alias, is_primary)
select b.id, v.alias, v.is_primary from public.job_brands b
join (values
  ('highlands-coffee', 'Highlands Coffee', true),
  ('trung-nguyen-legend', 'Trung Nguyên Legend', true),
  ('wallace', 'Wallace', true)
) as v(slug, alias, is_primary) on v.slug = b.slug
on conflict (brand_id, alias) do nothing;
commit;

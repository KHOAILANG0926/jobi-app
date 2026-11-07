-- 브랜드 로고 그림(Lee 2026-11-07 "OK"): 사이트 아이콘(favicon)은 마스코트·작은 그림이 나올 수 있어(NETCO = 마스코트),
-- 공식 사이트 로고 그림을 정사각형 256px로 맞춰 사이트에 함께 배포(public/brand-logos/<slug>.png)하고 브랜드가 그 그림을 먼저 쓴다.
-- 그림이 없는 브랜드는 지금처럼 사이트 아이콘. 그림은 brand-logo.yml(공식 사이트 주소에서만 받아 자동 맞춤)이 만든 PR로만 들어온다.
-- logo_source_url = 받은 공식 그림 주소(출처), logo_sha256 = 그때 받은 원본 지문(매달 비교해 바뀌면 검사표 표시).
do $pre$
begin
  if to_regclass('public.job_brands') is null then raise exception 'brand logo image: job_brands 없음'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'job_brands' and column_name = 'logo_url') then
    raise exception 'brand logo image: 이미 적용됨';
  end if;
end $pre$;

alter table public.job_brands
  add column logo_url text check (logo_url is null or logo_url ~ '^/brand-logos/[a-z0-9-]+\.png$'),
  add column logo_source_url text check (logo_source_url is null or logo_source_url ~ '^https://'),
  add column logo_sha256 text check (logo_sha256 is null or logo_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint job_brands_logo_complete check ((logo_url is null) = (logo_source_url is null) and (logo_url is null) = (logo_sha256 is null));
comment on column public.job_brands.logo_url is '브랜드 로고 그림(사이트에 함께 배포한 정사각형 PNG). 없으면 공식 사이트 아이콘.';
comment on column public.job_brands.logo_source_url is '로고 그림을 받은 공식 사이트 주소(출처).';
comment on column public.job_brands.logo_sha256 is '받을 때 원본 그림 지문 — 매달 공식 사이트 그림과 비교(brand-logo-watch.yml).';

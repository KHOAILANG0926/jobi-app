-- 운영 점검(읽기 전용): 브랜드 로고 그림 칸(Lee 2026-11-07).
do $check$
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'job_brands'
      and column_name in ('logo_url', 'logo_source_url', 'logo_sha256')) <> 3 then
    raise exception '브랜드 로고 그림 칸 없음';
  end if;
  if not has_column_privilege('anon', 'public.job_brands', 'logo_url', 'select') then raise exception '로고 그림 칸 공개 조회 안 됨'; end if;
  if exists (select 1 from public.job_brands where logo_url is not null and logo_url !~ '^/brand-logos/[a-z0-9-]+\.png$') then
    raise exception '로고 그림 주소 형식 오류';
  end if;
  raise notice 'brand_logo_image production check passed';
end $check$;

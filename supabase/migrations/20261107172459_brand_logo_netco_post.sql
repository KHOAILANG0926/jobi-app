-- 브랜드 로고 그림 기록(brand-logo.yml, Lee 2026-11-07): netco-post ← 공식 그림 주소, 원본 지문.
do $m$
declare n integer;
begin
  update public.job_brands set logo_url = '/brand-logos/netco-post.png', logo_source_url = 'https://netco.com.vn/logo.png', logo_sha256 = '60af7b007576602b787462f603b7f2debb546a29deec044c6f352dd9c13a8b24'
   where slug = 'netco-post' and domain is not null
     and lower(split_part(split_part('https://netco.com.vn/logo.png', '://', 2), '/', 1)) in (lower(domain), 'www.' || lower(domain));
  get diagnostics n = row_count;
  if n <> 1 then raise exception '브랜드 로고 그림: % 브랜드가 없거나 그림 주소가 공식 도메인이 아님', 'netco-post'; end if;
end $m$;

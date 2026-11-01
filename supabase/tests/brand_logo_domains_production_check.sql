-- Read-only: 확인된 브랜드 4개의 공식 사이트 domain.
do $$
begin
  if (select count(*) from public.job_brands where (slug, domain) in (('highlands-coffee','highlandscoffee.com.vn'),('trung-nguyen-legend','trungnguyenlegend.com'),('wallace','wallacevn.com'),('xanh-sm-gsm','greensm.com'))) <> 4 then
    raise exception 'brand logo domains not set';
  end if;
  raise notice 'brand_logo_domains production check passed';
end $$;

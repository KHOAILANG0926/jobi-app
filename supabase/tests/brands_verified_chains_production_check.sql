-- Read-only: 2026-11-01 등록 브랜드는 확인 출처·지점 수(3 이상)가 있어야 한다.
do $$
begin
  if (select count(*) from public.job_brands where slug in ('highlands-coffee','trung-nguyen-legend','wallace')
        and active and verified_branches >= 3 and evidence_url like 'https://%' and verified_on is not null) <> 3 then
    raise exception 'verified brands missing or without evidence';
  end if;
  if exists (select 1 from public.job_brands b where b.verified_on is not null
             and not exists (select 1 from public.job_brand_aliases a where a.brand_id = b.id and a.is_primary)) then
    raise exception 'verified brand without primary alias';
  end if;
  raise notice 'brands_verified_chains production check passed';
end $$;

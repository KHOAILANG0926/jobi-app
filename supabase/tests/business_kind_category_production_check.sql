-- Read-only post-migration checks (business kind category).
do $$
begin
  if public.category_for_job('5', '{"business_type":{"kind":"fnb"}}') <> 'am_thuc_do_uong'
     or public.category_for_job('5', '{"business_type":{"kind":"retail"}}') <> 'quan_ly_ban_hang'
     or public.category_for_job('82022', '{"business_type":{"kind":"fnb"}}') <> public.category_for_occupation('82022') then
    raise exception 'business kind category mapping failed';
  end if;
  if exists(select 1 from public.local_jobs where occupation_code is not null
    and category is distinct from public.category_for_job(occupation_code, ocr_check)) then
    raise exception 'business kind category mismatch in saved jobs';
  end if;
  raise notice 'business_kind_category production check passed';
end $$;

-- Read-only post-migration checks. Must not alter publication or evidence.
do $$
begin
  if public.category_for_occupation('82022') <> 'san_xuat_xay_dung'
     or public.category_for_occupation('8') <> 'san_xuat_xay_dung'
     or public.category_for_occupation('512') <> 'am_thuc_do_uong'
     or public.category_for_occupation('8322') <> 'lai_xe_giao_hang' then
    raise exception 'occupation category known-code mapping failed';
  end if;
  if exists(select 1 from public.local_jobs where occupation_code is not null
    and category is distinct from public.category_for_occupation(occupation_code)) then
    raise exception 'occupation category mismatch in saved jobs';
  end if;
  if (select count(*) from pg_trigger where tgrelid='public.local_jobs'::regclass
    and tgname in ('trg_00_occupation_category','trg_zzzy_occupation_category') and tgenabled='O') <> 2 then
    raise exception 'occupation category triggers missing or disabled';
  end if;
end $$;

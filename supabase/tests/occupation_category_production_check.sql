-- Read-only post-migration checks. Must not alter publication or evidence.
do $$
declare mismatch boolean;
begin
  if public.category_for_occupation('82022') <> 'san_xuat_xay_dung'
     or public.category_for_occupation('8') <> 'san_xuat_xay_dung'
     or public.category_for_occupation('512') <> 'am_thuc_do_uong'
     or public.category_for_occupation('8322') <> 'lai_xe_giao_hang' then
    raise exception 'occupation category known-code mapping failed';
  end if;
  -- 2026-11-01: 코드 5 가게 공고는 업종 종류로 칸을 정한다(category_for_job, 20261101200000). 그 함수가 있으면 그것과 비교(동적 실행: 없는 함수를 미리 해석하지 않게).
  if to_regprocedure('public.category_for_job(text,jsonb)') is not null then
    execute 'select exists(select 1 from public.local_jobs where occupation_code is not null and category is distinct from public.category_for_job(occupation_code, ocr_check))' into mismatch;
  else
    select exists(select 1 from public.local_jobs where occupation_code is not null and category is distinct from public.category_for_occupation(occupation_code)) into mismatch;
  end if;
  if mismatch then
    raise exception 'occupation category mismatch in saved jobs';
  end if;
  if (select count(*) from pg_trigger where tgrelid='public.local_jobs'::regclass
    and tgname in ('trg_00_occupation_category','trg_zzzy_occupation_category') and tgenabled='O') <> 2 then
    raise exception 'occupation category triggers missing or disabled';
  end if;
end $$;

-- 로컬 시험(폐기용 DB): 코드 5 + 업종 종류 → 메뉴 칸. 다른 코드는 기존 그대로.
do $$
declare c text;
begin
  insert into public.local_jobs(id, title, source_text, occupation_code, occupation_evidence, active, ocr_check)
  values (900001, 'WALLACE', 'WALLACE BẮC NINH tuyển', '5', 'WALLACE BẮC NINH', false, '{"business_type":{"kind":"fnb"}}');
  select category into c from public.local_jobs where id = 900001;
  if c <> 'am_thuc_do_uong' then raise exception 'fnb → am_thuc_do_uong (got %)', c; end if;
  update public.local_jobs set ocr_check = '{"business_type":{"kind":"retail"}}' where id = 900001;
  select category into c from public.local_jobs where id = 900001;
  if c <> 'quan_ly_ban_hang' then raise exception 'retail → quan_ly_ban_hang (got %)', c; end if;
  update public.local_jobs set ocr_check = '{}' where id = 900001;
  select category into c from public.local_jobs where id = 900001;
  if c <> public.category_for_occupation('5') then raise exception 'no kind → occupation default (got %)', c; end if;
  insert into public.local_jobs(id, title, source_text, occupation_code, occupation_evidence, active, ocr_check)
  values (900002, 'KDA', 'linh kiện tai nghe', '82022', 'linh kiện tai nghe', false, '{"business_type":{"kind":"fnb"}}');
  select category into c from public.local_jobs where id = 900002;
  if c <> 'san_xuat_xay_dung' then raise exception 'kind only applies to code 5 (got %)', c; end if;
  delete from public.local_jobs where id in (900001, 900002);
  raise notice 'business_kind_category local test: 4개 경우 통과';
end $$;

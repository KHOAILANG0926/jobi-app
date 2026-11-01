-- 2026-11-01 Lee: 업무 미기재 가게 공고(코드 5 "Nhân viên dịch vụ và bán hàng", CLAUDE.md 직업분류 절 예외)가
-- 메뉴 "Vệ sinh / Giúp việc"(dich_vu)에 나오던 문제(#5247 Wallace 닭튀김). 업종 확인 단계가 기록한 업종 종류
-- (ocr_check.business_type.kind: fnb·retail·service)로 메뉴 칸을 정한다. 코드 5가 아닌 공고는 기존 그대로(category_for_occupation).
-- 직업 코드·근거·공개 여부는 바꾸지 않는다. 코드 5 공고의 category만 다시 계산한다.
begin;
do $$ begin
  if to_regprocedure('public.category_for_occupation(text)') is null or to_regprocedure('public.sync_occupation_category()') is null then
    raise exception 'business kind category: occupation category objects missing';
  end if;
end $$;

create or replace function public.category_for_job(p_code text, p_ocr_check jsonb)
returns text language sql stable set search_path = '' as $$
  select case
    when p_code = '5' and p_ocr_check->'business_type'->>'kind' = 'fnb' then 'am_thuc_do_uong'
    when p_code = '5' and p_ocr_check->'business_type'->>'kind' = 'retail' then 'quan_ly_ban_hang'
    else public.category_for_occupation(p_code) end
$$;
revoke all on function public.category_for_job(text, jsonb) from public;
grant execute on function public.category_for_job(text, jsonb) to anon, authenticated, service_role;

create or replace function public.sync_occupation_category()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.category := public.category_for_job(new.occupation_code, new.ocr_check);
  return new;
end;
$$;
revoke all on function public.sync_occupation_category() from public;

update public.local_jobs set category = public.category_for_job(occupation_code, ocr_check)
 where occupation_code = '5' and category is distinct from public.category_for_job(occupation_code, ocr_check);
commit;

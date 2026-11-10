-- 운영 점검(읽기 전용): 시험용 Google 몫이 따로 있고, 운영 몫 값은 그대로다(Lee 2026-11-09).
do $check$
begin
  if (select monthly_limit from public.external_api_limits where api = 'google_text_search_test') is distinct from 600 then
    raise exception '시험용 Google 몫 없음 또는 값 다름';
  end if;
  if (select monthly_limit from public.external_api_limits where api = 'google_text_search') is distinct from 4500 then
    raise exception '운영 Google 몫 값이 바뀜';
  end if;
  if has_table_privilege('anon', 'public.external_api_limits', 'select') or has_table_privilege('authenticated', 'public.external_api_limits', 'select') then
    raise exception '한도 표가 외부에 열림';
  end if;
end $check$;

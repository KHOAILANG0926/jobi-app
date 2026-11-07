-- 운영 점검(읽기 전용): 로고 찾기·외부 API 월 한도(Lee 2026-11-07)가 있고, 외부에서 쓰거나 부르지 못한다.
do $check$
begin
  if to_regclass('public.external_api_calls') is null or to_regclass('public.external_api_limits') is null then
    raise exception '외부 API 한도 표 없음';
  end if;
  if (select monthly_limit from public.external_api_limits where api = 'google_text_search') is distinct from 4500
     or (select monthly_limit from public.external_api_limits where api = 'google_place_website') is distinct from 900 then
    raise exception '외부 API 한도 값 다름';
  end if;
  if has_function_privilege('anon', 'public.external_api_reserve(text)', 'execute')
     or has_function_privilege('authenticated', 'public.external_api_reserve(text)', 'execute')
     or has_function_privilege('anon', 'public.job_logo_lookup_record(bigint,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.job_logo_lookup_record(bigint,text,text,text)', 'execute') then
    raise exception '한도·로고 기록 함수가 외부에 열림';
  end if;
  if has_table_privilege('anon', 'public.external_api_calls', 'select') or has_table_privilege('authenticated', 'public.external_api_calls', 'insert') then
    raise exception '외부 API 횟수 표가 외부에 열림';
  end if;
  if not has_column_privilege('anon', 'public.local_jobs', 'company_domain', 'select') then
    raise exception '회사 웹사이트 칸이 공개 조회에 없음';
  end if;
  if has_column_privilege('anon', 'public.local_jobs', 'logo_lookup', 'select') then
    raise exception '로고 찾기 기록이 공개 조회에 보임';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_job_logo_lookup_guard' and not tgisinternal) then
    raise exception '회사 웹사이트 칸 보호 장치 없음';
  end if;
  if not exists (select 1 from public.job_brands where slug = 'netco-post' and domain = 'netco.com.vn' and verified_branches >= 3) then
    raise exception 'NETCO POST 브랜드 없음';
  end if;
  raise notice 'logo_lookup_api_limits production check passed';
end $check$;

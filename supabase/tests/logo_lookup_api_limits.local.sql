-- 회사 웹사이트 로고 찾기·외부 API 월 한도 동작 시험(예전 분기에서 그대로 옮김, Codex #585 P1).
do $t$
declare r text; ok boolean; i int;
begin
  insert into public.local_jobs(id, company, location) values (990001, 'Cty A', 'Bắc Ninh');
  -- 등록 경로로는 회사 웹사이트를 넣을 수 없다
  update public.local_jobs set company_domain = 'evil.com' where id = 990001;
  if (select company_domain from public.local_jobs where id = 990001) is not null then raise exception '보호 장치 실패'; end if;
  r := public.job_logo_lookup_record(990001, 'found', 'https://www.facebook.com/x', 'p1');
  if r <> 'none' then raise exception 'URL 형식 처리 오류: %', r; end if;
  r := public.job_logo_lookup_record(990001, 'found', 'facebook.com', 'p1');
  if r <> 'excluded' then raise exception '페이스북 제외 실패: %', r; end if;
  r := public.job_logo_lookup_record(990001, 'found', 'www.Netco.com.vn', 'p1');
  if r <> 'found' or (select company_domain from public.local_jobs where id = 990001) <> 'netco.com.vn' then raise exception '도메인 기록 실패'; end if;
  -- 월 한도: 900에서 멈춤
  for i in 1..900 loop ok := public.external_api_reserve('google_place_website'); if not ok then raise exception '한도 전에 멈춤 %', i; end if; end loop;
  if public.external_api_reserve('google_place_website') then raise exception '한도 넘김'; end if;
  if (select calls from public.external_api_calls where api = 'google_place_website') <> 900 then raise exception '횟수 오류'; end if;
  raise notice 'logo lookup CI cases passed';
end $t$;

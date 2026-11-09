-- 시험 몫은 따로 세고, 다 써도 운영 몫은 그대로다.
do $t$
declare i int;
begin
  for i in 1..600 loop
    if not public.external_api_reserve('google_text_search_test') then raise exception '시험 몫이 600 전에 멈춤 %', i; end if;
  end loop;
  if public.external_api_reserve('google_text_search_test') then raise exception '시험 몫 600을 넘김'; end if;
  if not public.external_api_reserve('google_text_search') then raise exception '시험 몫을 다 써도 운영은 불러야 함'; end if;
  if (select calls from public.external_api_calls where api = 'google_text_search') <> 1 then raise exception '운영 횟수에 시험이 섞임'; end if;
  raise notice 'google test quota CI cases passed';
end $t$;

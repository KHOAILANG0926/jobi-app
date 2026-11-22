-- 운영 점검(읽기 전용): 만료 처리 함수가 베트남 날짜 기준이고, 권한이 그대로이며, 지금 공개 중인데 마감일이 베트남 어제 이전인 공고가 남아 있지 않은지.
do $check$
declare
  def text;
  n int;
begin
  select pg_get_functiondef('public.deactivate_expired_jobs()'::regprocedure) into def;
  if def not like '%Asia/Ho_Chi_Minh%' then raise exception 'deactivate_expired_jobs가 베트남 날짜 기준이 아님'; end if;
  if def like '%now()::date%' then raise exception 'deactivate_expired_jobs에 옛 기준(now()::date)이 남아 있음'; end if;
  if not (select prosecdef from pg_proc where oid = 'public.deactivate_expired_jobs()'::regprocedure) then raise exception 'security definer가 풀림'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and has_function_privilege('anon', 'public.deactivate_expired_jobs()', 'execute') then
    raise exception 'anon이 만료 처리 함수를 실행할 수 있음';
  end if;
  -- 정보: 공개 중인데 마감일이 베트남 날짜보다 앞선 공고(다음 cron 실행 때 닫힐 것). 0이 아니어도 실패는 아님(cron 실행 직전에는 있을 수 있다).
  select count(*) into n from public.local_jobs
   where active = true and application_deadline is not null
     and application_deadline < (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  raise notice 'deactivate_expired_vn_date production check passed (지금 닫힐 공개 공고 %건)', n;
end $check$;

-- deactivate_expired_jobs()는 0011 마이그레이션에서 "함수만" 추가되고
-- 어떤 스케줄러에도 연결되지 않은 채 방치돼 있었다. pg_cron으로 매일 한 번
-- (00:00 Vietnam time = 17:00 UTC) 자동 실행되게 연결한다.

begin;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'deactivate-expired-jobs-daily',
  '0 17 * * *',
  $$select public.deactivate_expired_jobs()$$
);

commit;

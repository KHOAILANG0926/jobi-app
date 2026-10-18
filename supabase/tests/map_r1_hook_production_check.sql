-- 공고 저장 즉시 위치 찾기 장치가 운영에 있는지 점검(없으면 실패)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_job_saved') then raise exception 'trg_map_r1_job_saved missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_work_location_saved') then raise exception 'trg_map_r1_work_location_saved missing'; end if;
  if not exists (select 1 from cron.job where jobname = 'map-r1-retry-pending' and active) then raise exception 'map-r1-retry-pending cron missing'; end if;
  if not exists (select 1 from vault.secrets where name = 'map_r1_hook_token') then raise exception 'hook token missing'; end if;
  if has_function_privilege('anon', 'public.map_r1_hook_token_ok(text)', 'execute') then raise exception 'anon can check hook token'; end if;
end $$;

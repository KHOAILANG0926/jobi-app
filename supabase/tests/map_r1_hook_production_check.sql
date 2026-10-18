-- 공고 저장 즉시 위치 찾기 장치가 운영에 있는지 점검(없으면 실패)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_job_saved') then raise exception 'trg_map_r1_job_saved missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_work_location_saved') then raise exception 'trg_map_r1_work_location_saved missing'; end if;
  if not exists (select 1 from cron.job where jobname = 'map-r1-retry-pending' and active) then raise exception 'map-r1-retry-pending cron missing'; end if;
  if not exists (select 1 from vault.secrets where name = 'map_r1_hook_token') then raise exception 'hook token missing'; end if;
  if has_function_privilege('anon', 'public.map_r1_hook_token_ok(text)', 'execute') then raise exception 'anon can check hook token'; end if;
end $$;
do $$ begin
  if to_regclass('public.map_r1_unlocated') is null then return; end if; -- 결정 0006 적용 전
  if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_block_unlocated') then raise exception 'unlocated publish block missing'; end if;
  if not exists (select 1 from cron.job where jobname = 'map-r1-unlocated-retry' and active) then raise exception 'unlocated retry cron missing'; end if;
  if not exists (select 1 from cron.job where jobname = 'map-r1-unlocated-delete' and active) then raise exception 'unlocated delete cron missing'; end if;
  if has_table_privilege('anon', 'public.map_r1_unlocated', 'select') then raise exception 'anon can read unlocated'; end if;
end $$;

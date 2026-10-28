-- 공고 저장 즉시 위치 찾기 장치가 운영에 있는지 점검(없으면 실패)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_job_saved') then raise exception 'trg_map_r1_job_saved missing'; end if;
  if to_regprocedure('location_private.write_location(bigint,text,jsonb)') is null then
    -- Before the canonical migration, source changes still use the legacy hook.
    if not exists (select 1 from pg_trigger where tgname = 'trg_map_r1_work_location_saved'
      and tgrelid='public.job_work_locations'::regclass and tgenabled<>'D') then
      raise exception 'trg_map_r1_work_location_saved missing'; end if;
  else
    -- Canonical writes may insert an unresolved skeleton before finalizing it.
    -- Only the authorized batch adapter may request after the completed batch;
    -- a source-row hook would schedule unnecessary searches during approvals.
    if exists (select 1 from pg_trigger where tgrelid='public.job_work_locations'::regclass
      and not tgisinternal and tgenabled<>'D' and (tgname='trg_map_r1_work_location_saved'
      or tgfoid=to_regprocedure('public.map_r1_on_job_saved()')
      or tgfoid=to_regprocedure('location_private.work_address_saved()'))) then
      raise exception 'canonical source has unresolved-skeleton request hook'; end if;
    if not exists (select 1 from pg_trigger where tgname='trg_map_r1_job_saved'
      and tgrelid='public.local_jobs'::regclass and tgenabled<>'D'
      and tgfoid=to_regprocedure('public.map_r1_on_job_saved()')) then
      raise exception 'canonical parent save request hook missing'; end if;
    if not exists (select 1 from pg_proc where oid=to_regprocedure('public.replace_job_work_locations(bigint,jsonb)')
      and prosecdef and position('public.map_r1_request_location(p_job_id)' in prosrc)>0
      and position('before_addresses is distinct from after_addresses' in prosrc)>0
      and position('not location_verified' in prosrc)>0)
      or not has_function_privilege('service_role','public.replace_job_work_locations(bigint,jsonb)','execute')
      or has_function_privilege('anon','public.replace_job_work_locations(bigint,jsonb)','execute')
      or has_function_privilege('authenticated','public.replace_job_work_locations(bigint,jsonb)','execute') then
      raise exception 'canonical authorized batch requester missing/unsafe'; end if;
  end if;
  if not exists (select 1 from cron.job where jobname = 'map-r1-retry-pending' and active) then raise exception 'map-r1-retry-pending cron missing'; end if;
  if not exists (select 1 from vault.secrets where name = 'map_r1_hook_token') then raise exception 'hook token missing'; end if;
  if has_function_privilege('anon', 'public.map_r1_hook_token_ok(text)', 'execute') then raise exception 'anon can check hook token'; end if;
end $$;
do $$ begin
  if to_regclass('public.map_r1_unlocated') is null then return; end if; -- 결정 0006 적용 전
  -- Lee 2026-10-28 ①(수집 입구 20261028160000): 위치 결과는 공개 여부를 바꾸지 않는다 → 공개 막는 트리거는 없어야 한다.
  if exists (select 1 from pg_trigger where tgname = 'trg_map_r1_block_unlocated') then raise exception 'unlocated publish block must not exist (Lee 2026-10-28)'; end if;
  if not exists (select 1 from cron.job where jobname = 'map-r1-unlocated-retry' and active) then raise exception 'unlocated retry cron missing'; end if;
  if exists (select 1 from cron.job where jobname = 'map-r1-unlocated-delete') then raise exception 'auto-delete cron must not exist (Lee 2026-10-20)'; end if;
  if has_table_privilege('anon', 'public.map_r1_unlocated_report', 'select') then raise exception 'anon can read unlocated report'; end if;
  if has_function_privilege('anon', 'public.map_r1_delete_no_info(bigint)', 'execute') then raise exception 'anon can delete'; end if;
  if has_table_privilege('anon', 'public.map_r1_unlocated', 'select') then raise exception 'anon can read unlocated'; end if;
end $$;

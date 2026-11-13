-- 읽기 전용 적용 후 점검: 공고·검사 기록을 바꾸지 않는다. 공개 게이트 함수가 고용주·legacy를 포함하고 트리거가 켜져 있는지만 본다.
do $$
declare src text;
begin
  select pg_get_functiondef('public.enforce_job_inspect_current()'::regprocedure) into src;
  if src is null or src not like '%''crawler'', ''admin'', ''employer'', ''legacy''%' then
    raise exception 'inspect gate does not cover employer/legacy origins';
  end if;
  if (select count(*) from pg_trigger where tgrelid='public.local_jobs'::regclass and tgname='trg_zzz_inspect_current' and tgenabled='O') <> 1 then
    raise exception 'inspect gate trigger missing or disabled';
  end if;
end $$;

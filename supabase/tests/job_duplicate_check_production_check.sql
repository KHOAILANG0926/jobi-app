-- 운영 점검(읽기 전용): 중복 판정(Lee 2026-11-07 4단계)이 있고, 공개 조회·외부에서 판정을 쓰거나 부르지 못한다.
do $check$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='local_jobs' and column_name='duplicate_status') then
    raise exception 'local_jobs.duplicate_status 없음';
  end if;
  if to_regprocedure('public.job_duplicate_check(bigint)') is null or to_regprocedure('public.job_duplicate_decide(bigint,text)') is null
     or to_regprocedure('public.job_identity_attach(bigint,text,text,text,text,text,text[])') is null then
    raise exception '중복 판정 함수 없음';
  end if;
  if has_function_privilege('anon', 'public.job_duplicate_check(bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.job_duplicate_check(bigint)', 'execute')
     or has_function_privilege('anon', 'public.job_identity_attach(bigint,text,text,text,text,text,text[])', 'execute')
     or has_function_privilege('authenticated', 'public.job_identity_attach(bigint,text,text,text,text,text,text[])', 'execute')
     or has_function_privilege('anon', 'public.job_duplicate_decide(bigint,text)', 'execute') then
    raise exception '중복 판정 함수가 외부에 열림';
  end if;
  if has_column_privilege('anon', 'public.local_jobs', 'duplicate_status', 'select') then
    raise exception '중복 판정 칸이 공개 조회에 보임';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_zzzzz_duplicate_hold' and not tgisinternal) then
    raise exception '중복 비공개 유지 장치 없음';
  end if;
  -- 기존 공고(규칙 전 등록)는 판정 대상 아님
  if exists (select 1 from public.local_jobs where duplicate_status is not null and created_at < timestamptz '2026-11-07 07:00:00+07') then
    raise exception '기존 공고가 중복 판정됨';
  end if;
  raise notice 'job_duplicate_check production check passed';
end $check$;

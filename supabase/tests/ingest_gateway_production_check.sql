-- Read-only. 수집 입구(20261028160000) 운영 점검: 구조·권한·위치가 공개를 안 바꾸는 규칙. 실패 시 무엇이 다른지 표시.
do $check$
declare diff text := '';
begin
 if to_regclass('public.job_ingest_raw') is null then diff := diff || 'job_ingest_raw 없음; '; end if;
 if to_regclass('public.job_ingest_log') is null then diff := diff || 'job_ingest_log 없음; '; end if;
 if to_regclass('public.job_ai_suggestions') is null then diff := diff || 'job_ai_suggestions 없음; '; end if;
 select diff || coalesce(string_agg(c.relname || ' RLS 꺼짐; ', ''), '') into diff
   from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('job_ingest_raw','job_ingest_log','job_ai_suggestions') and not c.relrowsecurity;
 select diff || coalesce(string_agg(t || ' ' || r || ' 권한 있음; ', ''), '') into diff
   from unnest(array['job_ingest_raw','job_ingest_log','job_ai_suggestions']) t, unnest(array['anon','authenticated']) r
  where has_table_privilege(r, 'public.' || t, 'SELECT') or has_table_privilege(r, 'public.' || t, 'INSERT');
 if to_regprocedure('public.ingest_job(jsonb)') is null then diff := diff || 'ingest_job 없음; ';
 else
  if (select prosecdef from pg_proc where oid = 'public.ingest_job(jsonb)'::regprocedure) then diff := diff || 'ingest_job이 SECURITY DEFINER(기존 R3·R7 보호 우회 위험); '; end if;
  if has_function_privilege('anon', 'public.ingest_job(jsonb)', 'execute') or has_function_privilege('authenticated', 'public.ingest_job(jsonb)', 'execute') then
   diff := diff || 'ingest_job 실행 권한이 anon/authenticated에 있음; '; end if;
  if not has_function_privilege('service_role', 'public.ingest_job(jsonb)', 'execute') then diff := diff || 'service_role이 ingest_job 실행 불가; '; end if;
 end if;
 -- 위치 결과는 공개 여부를 바꾸지 않는다(Lee 2026-10-28 ①).
 if exists(select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_map_r1_block_unlocated' and not tgisinternal) then
  diff := diff || 'trg_map_r1_block_unlocated(위치 때문에 공개 막음)가 남아 있음; '; end if;
 if position('active' in (select prosrc from pg_proc where oid = 'public.map_r1_mark_unlocated(bigint,text)'::regprocedure)) > 0
    and position('update public.local_jobs' in lower((select prosrc from pg_proc where oid = 'public.map_r1_mark_unlocated(bigint,text)'::regprocedure))) > 0 then
  diff := diff || 'map_r1_mark_unlocated가 아직 local_jobs를 고침; '; end if;
 if diff <> '' then raise exception 'ingest gateway check: %', diff; end if;
end $check$;

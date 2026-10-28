-- Read-only. 수집 입구 2단계(20261029010000) 운영 점검: 공고 등록은 ingest_job 하나만. 실패 시 무엇이 다른지 표시.
do $check$
declare diff text := '';
begin
 if to_regnamespace('ingest_private') is null then diff := diff || 'ingest_private 스키마 없음; '; end if;
 -- ① 입구 밖 등록 거부 장치가 모든 INSERT 앞에 있어야 한다(이름 순서상 맨 앞, 켜져 있음)
 if not exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_00_ingest_gateway_only'
                and not tgisinternal and tgenabled in ('O', 'A')) then
  diff := diff || 'trg_00_ingest_gateway_only 없음/꺼짐; ';
 end if;
 if (select min(tgname) from pg_trigger where tgrelid = 'public.local_jobs'::regclass and not tgisinternal
      and (tgtype & 2) = 2 and (tgtype & 4) = 4) is distinct from 'trg_00_ingest_gateway_only' then
  diff := diff || '입구 거부 장치가 BEFORE INSERT 첫 번째가 아님; ';
 end if;
 -- ② 입구는 부른 사람 권한(INVOKER) — definer면 R3·R7 "DB 소유자=기계" 예외를 잘못 얻는다
 if (select prosecdef from pg_proc where oid = 'public.ingest_job(jsonb)'::regprocedure) then
  diff := diff || 'ingest_job이 SECURITY DEFINER; ';
 end if;
 select diff || coalesce(string_agg(r || ' ingest_job 실행 불가; ', ''), '') into diff
   from unnest(array['anon', 'authenticated', 'service_role']) r where not has_function_privilege(r, 'public.ingest_job(jsonb)', 'execute');
 -- ③ 옛 관리자 등록 함수(소유자 권한) 닫힘
 if to_regprocedure('public.admin_create_job(jsonb)') is not null and (has_function_privilege('authenticated', 'public.admin_create_job(jsonb)', 'execute')
    or has_function_privilege('anon', 'public.admin_create_job(jsonb)', 'execute')) then
  diff := diff || 'admin_create_job 실행 권한 남아 있음; ';
 end if;
 -- ④ 원문·기록 표는 여전히 앱에서 직접 읽기·쓰기 불가
 select diff || coalesce(string_agg(t || ' ' || r || ' 권한 있음; ', ''), '') into diff
   from unnest(array['job_ingest_raw', 'job_ingest_log']) t, unnest(array['anon', 'authenticated']) r
  where has_table_privilege(r, 'public.' || t, 'SELECT') or has_table_privilege(r, 'public.' || t, 'INSERT');
 -- ⑤ 관리자 등록 정책(관리자만, origin=admin)
 if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'local_jobs' and policyname = 'local_jobs_admin_insert'
                and cmd = 'INSERT' and with_check like '%is_admin()%' and with_check like '%origin%admin%') then
  diff := diff || 'local_jobs_admin_insert 정책 없음/다름; ';
 end if;
 -- ⑥ 입구 밖 직접 등록이 실제로 거부되는지(점검용 트랜잭션 안, 저장되지 않음)
 begin
  insert into public.local_jobs(title, company, source_text, source_url) values ('점검', '점검', '점검', 'https://check.invalid/1');
  diff := diff || 'DB 소유자 직접 INSERT가 통과함; ';
 exception when insufficient_privilege then
  if sqlerrm !~ 'ingest_gateway' then diff := diff || '직접 INSERT가 다른 이유로 거부: ' || sqlerrm || '; '; end if;
 end;
 if diff <> '' then raise exception 'ingest one-door check: %', diff; end if;
end $check$;

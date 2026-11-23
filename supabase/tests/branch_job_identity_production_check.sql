-- 읽기 전용 운영 점검(데이터 변경 없음): 지점별 독립 공고 identity 함수가 적용됐는지.
\set ON_ERROR_STOP 1
do $$
begin
 if to_regprocedure('ingest_private.find_existing(bigint,text,text,text,text,text,text)') is null then raise exception 'branch identity: find_existing(7) 없음'; end if;
 if to_regprocedure('ingest_private.find_existing(bigint,text,text,text,text,text)') is not null then raise exception 'branch identity: 6개 자리 find_existing이 남아 있음'; end if;
 if to_regprocedure('ingest_private.branch_key(text)') is null then raise exception 'branch identity: branch_key 없음'; end if;
 if position('ingest_private.branch_key(p->>''branch_location'')' in pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure)) = 0 then raise exception 'branch identity: ingest_job 해시에 지점 위치 없음'; end if;
 if position('p->>''source_text'', p->>''branch_location'')' in pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure)) = 0 then raise exception 'branch identity: ingest_job이 지점 위치를 find_existing에 넘기지 않음'; end if;
 if position('s.source_url' in pg_get_functiondef('dedupe_private.verdict(bigint)'::regprocedure)) = 0 then raise exception 'branch identity: 중복 판정에 같은 글 형제 면제 없음'; end if;
end $$;
select 'PASS: branch_job_identity production check' as result;

-- 읽기 전용 운영 점검(데이터 변경 없음): 쓰기 입구 보호 두 줄이 적용됐는지.
\set ON_ERROR_STOP 1
do $$
declare d text := pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure);
begin
 if position('if ch = ''employer'' then p := p - ''source_url''; end if;' in d) = 0 then raise exception 'ingest write guard: 기업 경로 source_url 제거 줄이 없음'; end if;
 if position('ch like ''crawler_%'' and st.origin is distinct from ''crawler''' in d) = 0 then raise exception 'ingest write guard: 수집 경로의 비수집 공고 덮어쓰기 차단이 없음'; end if;
 if position('pg_advisory_xact_lock(hashtextextended(hash, 0))' in d) = 0 then raise exception 'ingest write guard: 동시 등록 직렬화 잠금이 없음'; end if;
 if position('pg_advisory_xact_lock(hashtextextended(p->>''source_url'', 1))' in d) = 0 then raise exception 'ingest write guard: 같은 원문 주소 동시 수집 직렬화 잠금이 없음'; end if;
 if position('refresh_skipped:origin' in d) = 0 then raise exception 'ingest write guard: 건너뛴 갱신 기록이 없음'; end if;
 if position('branch_location' in d) = 0 then raise exception 'ingest write guard: 지점 위치 판정 줄이 사라짐(이전 migration 손상)'; end if;
end $$;
select 'PASS: ingest_write_guard production check' as result;

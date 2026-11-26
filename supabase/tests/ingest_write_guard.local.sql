-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 20261126010000_ingest_write_guard 적용 뒤 실행 — 본문이 바뀌었는지만 확인.
-- 실제 동작(수집 경로가 기업·관리자 공고를 안 덮어씀, 기업 경로 source_url 무시)은 ingest_write_guard.pglite.test.mjs가 운영 본문으로 시험한다.
\set ON_ERROR_STOP 1
do $$
declare d text := pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure);
begin
 if position('p := p - ''source_url''' in d) = 0 then raise exception 'ingest write guard: 기업 경로 source_url 제거 줄이 없음'; end if;
 if position('refresh_skipped:origin' in d) = 0 then raise exception 'ingest write guard: 수집 경로 덮어쓰기 차단이 없음'; end if;
 if position('if st.origin is distinct from origin_v or st.admin_hidden then' in d) = 0 then raise exception 'ingest write guard: 기존 갱신 칸 보호 줄이 사라짐'; end if;
end $$;
select 'PASS: ingest_write_guard local' as result;

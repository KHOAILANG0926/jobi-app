-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 20261126020000_job_apply_and_contact_gate 적용 뒤 실행 — 트리거와 본문이 들어갔는지만 확인.
-- 실제 동작(마감·숨김 지원 거부, 공개 중 연락처 제거 거부, 그대로인 경로)은 job_apply_and_contact_gate.pglite.test.mjs가 운영 공개 판정 본문으로 시험한다.
\set ON_ERROR_STOP 1
do $$
begin
 if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.applications'::regclass and t.tgname = 'applications_job_open_gate' and not t.tgisinternal) then raise exception 'apply gate: 지원 트리거가 없음'; end if;
 if position('FOR SHARE' in upper(pg_get_functiondef('public.applications_job_open_gate()'::regprocedure))) = 0 then raise exception 'apply gate: 공고 행 잠금(FOR SHARE)이 없음'; end if;
 if position('publish gate: 공개 중인 공고에서' in pg_get_functiondef('public.enforce_job_publish_gate()'::regprocedure)) = 0 then raise exception 'contact gate: 기업 공개 중 연락처 제거 거부 줄이 없음'; end if;
 if position('not in (''crawler'', ''admin'')' in pg_get_functiondef('public.enforce_job_publish_gate()'::regprocedure)) = 0 then raise exception 'contact gate: 수집·관리자 기존 줄이 사라짐'; end if;
end $$;
select 'PASS: job_apply_and_contact_gate local' as result;

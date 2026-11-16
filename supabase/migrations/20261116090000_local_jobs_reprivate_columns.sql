-- 2026-11-16: local_jobs 비공개 칸 권한 되돌리기 (운영 점검 실패 run 43687539572 원인 복구)
-- 원인 [직접 확인]: 2026-11-15T06:54 #824 병합이 .github/workflows/local-jobs-privileges-apply.yml을 고치자 그 파일의 push 조건으로
--   옛 migration 20261014100000_local_jobs_column_privileges.sql이 운영 DB에 다시 실행됐다(run 43687539714, "REVOKE" 뒤 칸 목록 재부여).
--   그 migration은 "고정 5칸 빼고 지금 있는 모든 칸"을 anon·authenticated에 다시 열어, 10-14 뒤에 추가되어 비공개였던 칸까지 공개됐다.
--   1초 뒤 migrations-apply 운영 점검이 "소개소 근무 공장 칸이 공개 조회됨"으로 실패(run 43687539572).
-- 되돌리는 칸 = 10-14 뒤 local_jobs에 추가된 칸 중 anon·authenticated에 select를 준 적 없는 칸 전부(11-15 이전 상태 그대로).
--   공개로 준 칸(occupation_code·occupation_evidence·company_domain·recruiter_agency·description_html·employment_type_extra)은 건드리지 않는다.
-- 한 파일 = 한 트랜잭션. 칸이 없으면 RAISE로 전체 취소(근거 누락 방지).
do $do$
declare c text;
begin
  foreach c in array array['updated_at','company_id','company_branch_id','duplicate_status','duplicate_of','duplicate_reason','logo_lookup','agency_workplace_key'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = c) then
      raise exception 'local_jobs 칸 없음: %', c;
    end if;
    execute format('revoke select (%I) on public.local_jobs from anon, authenticated', c);
  end loop;
end $do$;

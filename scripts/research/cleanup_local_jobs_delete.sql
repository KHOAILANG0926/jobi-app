-- 기존 크롤러 공고 정리: local_jobs에서 #4682를 제외한 281건 삭제 (사용자 지시 2026-10-07)
-- ※ 사용자가 직접 실행. 실행 전 백업 확인: backups/20261007T121508Z (local_jobs 281 / job_work_locations 493 / job_location_candidates 1 / admin_audit_logs 3).
-- 가드: 건수가 281이 아니거나 #4682가 없거나 지원·면접·채팅·알림 참조가 있으면 예외로 전체 중단(아무것도 지워지지 않음).
-- ON DELETE CASCADE로 job_work_locations(493)·job_location_candidates(1)도 함께 삭제된다. admin_audit_logs(job 대상 3건)는 FK가 없어 남는다(감사 기록 보존).
begin;

do $$
declare n int;
begin
  select count(*) into n from public.local_jobs where id <> 4682;
  if n <> 281 then raise exception 'expected 281 rows to delete, found %', n; end if;
  if not exists (select 1 from public.local_jobs where id = 4682) then raise exception '#4682 not found'; end if;
  if exists (select 1 from public.local_jobs where id <> 4682 and (origin <> 'crawler' or employer_id is not null or coalesce(employer_phone, '') <> '' or (active and not admin_hidden))) then
    raise exception 'target set is not all crawler/no-employer/no-phone/non-public rows';
  end if;
  if exists (select 1 from public.applications a where a.job_id <> 4682)
     or exists (select 1 from public.interviews a where a.job_id <> 4682)
     or exists (select 1 from public.message_threads a where a.job_id <> 4682)
     or exists (select 1 from public.job_alert_notifications a where a.job_id <> 4682) then
    raise exception 'referenced by applications/interviews/message_threads/job_alert_notifications';
  end if;
end $$;

delete from public.local_jobs where id <> 4682;

-- 확인: 1행(#4682)만 남고 source_url 있는 행은 0이어야 한다. 아니면 rollback.
select count(*) as remaining, bool_and(id = 4682) as only_4682, count(source_url) as with_source_url from public.local_jobs;

commit;

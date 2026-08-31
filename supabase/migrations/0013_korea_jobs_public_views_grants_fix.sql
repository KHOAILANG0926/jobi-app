-- 0012에서 만든 korea_jobs_public / korea_job_work_locations_public 뷰에 SELECT만
-- grant했는데도, 이 프로젝트의 public 스키마 ALTER DEFAULT PRIVILEGES 설정 때문에
-- anon/authenticated가 INSERT/UPDATE/DELETE/TRUNCATE까지 자동으로 받은 것을 발견했다
-- (0012 적용 직후 information_schema.role_table_grants로 확인). 두 뷰는 단일 베이스
-- 테이블에 대한 단순 SELECT + WHERE라 Postgres가 "auto-updatable view"로 취급하므로,
-- 이 grant가 남아있으면 anon이 뷰를 통해 실제로 베이스 테이블(korea_jobs /
-- korea_job_work_locations)에 DELETE/UPDATE/INSERT를 실행할 수 있는 실질적 구멍이 된다.
-- 베이스 테이블 자체는 0012에서 이미 anon/authenticated GRANT를 전부 revoke해뒀으므로
-- 영향받지 않았다 — 이번 수정은 뷰 2개에 한정된다.

begin;

revoke all privileges on public.korea_jobs_public from anon, authenticated;
revoke all privileges on public.korea_job_work_locations_public from anon, authenticated;

grant select on public.korea_jobs_public to anon, authenticated;
grant select on public.korea_job_work_locations_public to anon, authenticated;

commit;

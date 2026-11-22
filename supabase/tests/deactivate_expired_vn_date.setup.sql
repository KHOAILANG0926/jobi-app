-- 빈 시험 DB(scripts/ci/postgres-location-fixture.sql)의 public.local_jobs에는 만료 처리가 쓰는 칸이 없다 — 시험용으로만 채운다.
alter table public.local_jobs add column if not exists active boolean default true;
alter table public.local_jobs add column if not exists application_deadline date;

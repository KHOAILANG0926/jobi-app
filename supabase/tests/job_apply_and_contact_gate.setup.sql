-- 시험 DB 준비(폐기용): 지원 표 대역과 운영 공개 판정 트리거 함수 중 이 migration이 바꾸는 줄만 가진 대역.
-- 진짜 운영 본문 대상 시험과 실제 동작 시험은 job_apply_and_contact_gate.pglite.test.mjs(운영 20261101190000 본문을 파일에서 그대로 읽음)가 한다.
alter table public.local_jobs add column if not exists active boolean not null default true;
alter table public.local_jobs add column if not exists admin_hidden boolean not null default false;
alter table public.local_jobs add column if not exists application_deadline date;
create table if not exists public.applications (id bigint generated always as identity primary key, job_id bigint not null, seeker_id uuid not null default gen_random_uuid());
create or replace function public.enforce_job_publish_gate() returns trigger language plpgsql as $f$
begin
  if coalesce(new.origin, '') not in ('crawler', 'admin') then return new; end if;
  return new;
end $f$;

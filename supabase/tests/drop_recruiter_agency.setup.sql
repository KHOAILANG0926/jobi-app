-- 20261107230000_drop_recruiter_agency.sql 시험 DB 준비 + 보호 확인(예전 분기에서 옮김, Codex #585 P1):
-- 이 칸에만 소개소로 적힌 공고가 있으면 칸 지우기가 멈춰야 한다.
alter table public.local_jobs add column if not exists recruitment_type text, add column if not exists recruiter_agency boolean not null default false;
\set ON_ERROR_STOP 0
begin;
insert into public.local_jobs(id, company, recruiter_agency) values (987654321, 'Nhân lực CI', true);
\i supabase/migrations/20261107230000_drop_recruiter_agency.sql
\if :ERROR
rollback;
\set ON_ERROR_STOP 1
\else
rollback;
\set ON_ERROR_STOP 1
do $t$ begin raise exception '이 칸에만 소개소로 적힌 공고가 있는데 칸이 지워짐'; end $t$;
\endif

-- 2026-10-15 롤백: 20261015100000_occupation_master.sql + _seed.sql 되돌리기.
-- 이 세 테이블은 새로 만든 것이며 다른 테이블이 참조하지 않는다(R8 연결 전 기준).
-- R8에서 local_jobs 등이 occupation_master 를 참조하게 된 뒤에는 그 참조를 먼저 제거해야 한다.
begin;
drop table if exists public.occupation_aliases;
drop table if exists public.occupation_descriptions;
drop table if exists public.occupation_master;
commit;

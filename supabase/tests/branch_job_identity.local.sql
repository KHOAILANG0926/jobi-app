-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 20261124000000_branch_job_identity 적용 뒤 실행.
-- 같은 원문 글의 지점 A·B는 각자 공고, 새 지점 C는 새 공고, 지점 위치가 없으면 예전 동작. (진짜 운영 본문 대상 시험: branch_job_identity.pglite.test.mjs)
\set ON_ERROR_STOP 1
set client_min_messages = warning;
begin;
insert into public.local_jobs(id, company, location, source_url, source_text, employer_phone) values
 (991001, 'CTY Hojeong', 'A', 'https://facebook.com/posts/branch-test', 'Tuyển 2 lô', '0912345678'),
 (991002, 'CTY Hojeong', 'B', 'https://facebook.com/posts/branch-test', 'Tuyển 2 lô', '0912345678');
insert into public.job_work_locations(id, job_id, raw_address, normalized_address) values
 (9910011, 991001, 'Lô A1, KCN Quế Võ, Bắc Ninh', public.admin_location_key('Lô A1, KCN Quế Võ, Bắc Ninh')),
 (9910021, 991002, 'Lô D4, KCN Quế Võ, Bắc Ninh', public.admin_location_key('Lô D4, KCN Quế Võ, Bắc Ninh'));
insert into public.job_ingest_raw(source_url, content_hash, job_id) values
 ('https://facebook.com/posts/branch-test', 'h-a', 991001), ('https://facebook.com/posts/branch-test', 'h-b', 991002);
do $$
declare u text := 'https://facebook.com/posts/branch-test'; got bigint;
begin
 select ingest_private.find_existing(0, 'other', u, '0912345678', 'CTY Hojeong', 'Tuyển 2 lô', null) into got;
 if got is distinct from 991001 then raise exception 'branch identity: 지점 위치가 없으면 예전 동작(첫 공고) 기대 991001, 실제 %', got; end if;
 select ingest_private.find_existing(0, 'other', u, '0912345678', 'CTY Hojeong', 'Tuyển 2 lô', 'lô d4 kcn quế võ bắc ninh') into got;
 if got is distinct from 991002 then raise exception 'branch identity: 지점 B는 자기 공고 991002 기대, 실제 %', got; end if;
 select ingest_private.find_existing(0, 'other', u, '0912345678', 'CTY Hojeong', 'Tuyển 2 lô', 'Lô E7, KCN Quế Võ, Bắc Ninh') into got;
 if got is not null then raise exception 'branch identity: 새 지점 C는 기존 공고가 없어야 함(새 공고), 실제 %', got; end if;
 if to_regprocedure('ingest_private.find_existing(bigint,text,text,text,text,text)') is not null then raise exception 'branch identity: 6개 자리 find_existing이 남아 있음'; end if;
 if position('branch_location' in pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure)) = 0 then raise exception 'branch identity: ingest_job에 지점 위치가 없음'; end if;
 if position('s.source_url' in pg_get_functiondef('dedupe_private.verdict(bigint)'::regprocedure)) = 0 then raise exception 'branch identity: verdict에 형제 지점 면제가 없음'; end if;
end $$;
do $$
declare v text;
begin
 select verdict into v from dedupe_private.verdict(991002);
 if v <> 'new' then raise exception 'branch identity: 같은 원문 글의 형제 지점 공고는 중복이 아니어야 함, 실제 %', v; end if;
end $$;
rollback;
select 'PASS: branch_job_identity local' as result;

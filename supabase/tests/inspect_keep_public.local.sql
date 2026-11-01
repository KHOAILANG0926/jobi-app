-- 20261101170000_inspect_keep_public.sql 실제 PostgreSQL 시험(폐기용 DB).
-- ① 공개 중 내용 변경 → 공개 유지 ② 새 공고 공개 요청 → 검사 전 거부(hold) ③ 지금 내용 통과 기록 → 공개 시작
-- ④ 옛 내용 통과 기록으로 공개 시작 → 거부 ⑤ 직접 내리면 hold 제거 ⑥ 기업 공고 영향 없음
do $test$
declare
  r public.local_jobs;
  h text;
begin
  insert into public.local_jobs (id, origin, title, description, active) values (9101, 'crawler', 'A', 'x', true), (9102, 'employer', 'B', 'y', true);
  if (select active from public.local_jobs where id = 9101) then raise exception '② 검사 전 새 공고 공개됨'; end if;
  select * into r from public.local_jobs where id = 9101; h := public.job_inspect_content_hash(r);
  update public.local_jobs set description = 'x2' where id = 9101;
  update public.local_jobs set active = true, ocr_check = ocr_check || jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', true)) where id = 9101;
  if (select active from public.local_jobs where id = 9101) then raise exception '④ 옛 내용 통과 기록으로 공개됨'; end if;
  select * into r from public.local_jobs where id = 9101; h := public.job_inspect_content_hash(r);
  update public.local_jobs set active = true, ocr_check = (ocr_check - 'inspect_hold') || jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', true)) where id = 9101;
  if not (select active from public.local_jobs where id = 9101) then raise exception '③ 지금 내용 통과로 공개 안 됨'; end if;
  update public.local_jobs set description = 'x3 changed' where id = 9101;
  if not (select active from public.local_jobs where id = 9101) then raise exception '① 공개 중 내용 변경으로 내려감'; end if;
  update public.local_jobs set ocr_check = ocr_check || '{"inspect_hold":true}' where id = 9101;
  update public.local_jobs set active = false where id = 9101;
  if (select ocr_check ? 'inspect_hold' from public.local_jobs where id = 9101) then raise exception '⑤ hold 남음'; end if;
  update public.local_jobs set description = 'z' where id = 9102;
  if not (select active from public.local_jobs where id = 9102) then raise exception '⑥ 기업 공고 내려감'; end if;
  delete from public.local_jobs where id in (9101, 9102);
  raise notice 'inspect_keep_public local test: 6개 경우 통과';
end $test$;

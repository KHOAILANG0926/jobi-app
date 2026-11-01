-- 20261101110000_job_inspect_content_hash.sql 실제 PostgreSQL 시험(폐기용 DB, 운영 접속 없음).
-- CI: scripts/ci/check-postgres-migrations.sh 가 깨끗한 DB에 최소 표를 만들고 migration 적용 후 이 파일을 실행한다.
-- 시나리오: ① 공개 중 내용 외 변경 → 유지 ② 내용 변경 → 내려가고 hold ③ 지금 내용으로 검사 통과 → 다시 공개
--          ④ 옛 내용 검사 기록으로 공개 요청 → 거부 ⑤ 검사 실패(publishable=false) 기록으로 공개 요청 → 거부
--          ⑥ 직접 내린 공고는 hold 제거 ⑦ 새 공고 공개 요청 → 검사 전 거부 ⑧ crawler/admin 외 공고는 영향 없음
do $test$
declare
  r public.local_jobs;
  h text;
begin
  insert into public.local_jobs (id, origin, title, description, active) values
    (9001, 'crawler', 'A', 'Công việc A', false),
    (9002, 'employer', 'B', 'x', true);

  -- 처음 공개: 현재 내용으로 통과 기록과 함께 요청하면 허용
  select * into r from public.local_jobs where id = 9001;
  h := public.job_inspect_content_hash(r);
  update public.local_jobs set active = true,
    ocr_check = jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', true)) where id = 9001;
  if not (select active from public.local_jobs where id = 9001) then raise exception '③ 현재 내용 통과 기록으로 공개 거부됨'; end if;

  -- ① 내용 외 변경(검사 기록 갱신) → 공개 유지
  update public.local_jobs set ocr_check = ocr_check || '{"note":1}' where id = 9001;
  if not (select active from public.local_jobs where id = 9001) then raise exception '① 내용 외 변경으로 내려감'; end if;

  -- ② 내용 변경 → 내려가고 hold
  update public.local_jobs set description = 'Công việc B' where id = 9001;
  select * into r from public.local_jobs where id = 9001;
  if r.active or not coalesce((r.ocr_check->>'inspect_hold')::boolean, false) then raise exception '② 내용 변경 후 공개 유지 또는 hold 없음'; end if;

  -- ④ 옛 내용 검사 기록으로 공개 요청 → 거부
  update public.local_jobs set active = true where id = 9001;
  if (select active from public.local_jobs where id = 9001) then raise exception '④ 옛 내용 검사 기록으로 공개됨'; end if;

  -- ⑤ 현재 내용이지만 검사 실패 기록 → 거부
  select * into r from public.local_jobs where id = 9001;
  h := public.job_inspect_content_hash(r);
  update public.local_jobs set active = true,
    ocr_check = ocr_check || jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', false)) where id = 9001;
  if (select active from public.local_jobs where id = 9001) then raise exception '⑤ 검사 실패 기록으로 공개됨'; end if;

  -- ③ 현재 내용 통과 → 다시 공개(검사기와 같은 쿼리 모양: hold 제거 + inspect 기록 + active)
  update public.local_jobs set active = true,
    ocr_check = (ocr_check - 'inspect_hold') || jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', true)) where id = 9001;
  select * into r from public.local_jobs where id = 9001;
  if not r.active or r.ocr_check ? 'inspect_hold' then raise exception '③ 재공개 실패'; end if;

  -- ⑥ 직접 내리면 hold 제거(검사기가 되살리지 않음)
  update public.local_jobs set ocr_check = ocr_check || '{"inspect_hold":true}' where id = 9001;
  update public.local_jobs set active = false where id = 9001;
  if (select ocr_check ? 'inspect_hold' from public.local_jobs where id = 9001) then raise exception '⑥ 직접 내린 공고에 hold 남음'; end if;

  -- ⑦ 새 crawler 공고 공개 요청 → 검사 전 거부
  insert into public.local_jobs (id, origin, title, description, active) values (9003, 'admin', 'C', 'y', true);
  if (select active from public.local_jobs where id = 9003) then raise exception '⑦ 검사 전 새 공고 공개됨'; end if;

  -- ⑧ 기업 직접 등록 공고는 영향 없음
  update public.local_jobs set description = 'changed' where id = 9002;
  if not (select active from public.local_jobs where id = 9002) then raise exception '⑧ 기업 공고가 내려감'; end if;

  delete from public.local_jobs where id in (9001, 9002, 9003);
  raise notice 'job_inspect_content_hash local test: 8개 경우 통과';
end $test$;

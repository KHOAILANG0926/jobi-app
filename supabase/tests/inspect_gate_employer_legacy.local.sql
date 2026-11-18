-- supabase/migrations/20261113000000_inspect_gate_employer_legacy.sql 의 실제 PostgreSQL 시험(폐기용 DB, 운영 접속 없음).
-- ① 고용주 새 공고 공개 요청 → 검사 전 거부(hold) ② legacy 같음 ③ 지금 내용 통과 기록 → 공개 시작 ④ 옛 내용 통과 기록 → 거부
-- ⑤ 이미 공개 중인 고용주 공고는 내용이 바뀌어도 유지 ⑥ 고용주가 직접 내린 공고는 hold 없이 비공개 그대로 ⑦ crawler 동작 그대로
do $test$
declare r public.local_jobs; h text;
begin
  insert into public.local_jobs (id, origin, title, description, active) values (9301, 'employer', 'E', 'x', true), (9302, 'legacy', 'L', 'y', true), (9303, 'crawler', 'C', 'z', true);
  if (select active from public.local_jobs where id = 9301) then raise exception '① 검사 전 고용주 새 공고가 공개됨'; end if;
  if not coalesce((select ocr_check->>'inspect_hold' from public.local_jobs where id = 9301)::boolean, false) then raise exception '① hold 표시 없음'; end if;
  if (select active from public.local_jobs where id = 9302) then raise exception '② 검사 전 legacy 공고가 공개됨'; end if;
  if (select active from public.local_jobs where id = 9303) then raise exception '⑦ crawler 동작이 바뀜(검사 전 공개됨)'; end if;
  select * into r from public.local_jobs where id = 9301; h := public.job_inspect_content_hash(r);
  update public.local_jobs set description = 'x2' where id = 9301;
  update public.local_jobs set active = true, ocr_check = (ocr_check - 'inspect_hold') || jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', true)) where id = 9301;
  if (select active from public.local_jobs where id = 9301) then raise exception '④ 옛 내용 통과 기록으로 공개됨'; end if;
  select * into r from public.local_jobs where id = 9301; h := public.job_inspect_content_hash(r);
  update public.local_jobs set active = true, ocr_check = (ocr_check - 'inspect_hold') || jsonb_build_object('inspect', jsonb_build_object('content_hash', h, 'publishable', true)) where id = 9301;
  if not (select active from public.local_jobs where id = 9301) then raise exception '③ 지금 내용 통과 기록으로 공개 안 됨'; end if;
  update public.local_jobs set description = 'x3 changed' where id = 9301;
  if not (select active from public.local_jobs where id = 9301) then raise exception '⑤ 공개 중 고용주 공고가 내용 변경으로 내려감'; end if;
  update public.local_jobs set active = false where id = 9301;
  if (select ocr_check ? 'inspect_hold' from public.local_jobs where id = 9301) then raise exception '⑥ 직접 내린 공고에 hold가 남음(검사기가 다시 올릴 수 있음)'; end if;
  -- ⑧ 검사 대기(hold) 중인 고용주 공고를 소유자가 내림(active=false만 씀) → hold 제거, 검사기 범위에서 빠짐
  update public.local_jobs set active = true where id = 9301;
  if not coalesce((select ocr_check->>'inspect_hold' from public.local_jobs where id = 9301)::boolean, false) then raise exception '⑧ 준비: hold 안 걸림'; end if;
  update public.local_jobs set active = false where id = 9301;
  if (select ocr_check ? 'inspect_hold' from public.local_jobs where id = 9301) then raise exception '⑧ 대기 중 철회 뒤 hold가 남음(검사기가 다시 공개할 수 있음)'; end if;
  -- ⑨ 검사기 갱신(ocr_check에 검사 기록을 같이 씀)은 hold를 유지
  update public.local_jobs set active = true where id = 9302;
  update public.local_jobs set active = false, ocr_check = ocr_check || jsonb_build_object('inspect', jsonb_build_object('publishable', false)) where id = 9302;
  if not coalesce((select ocr_check->>'inspect_hold' from public.local_jobs where id = 9302)::boolean, false) then raise exception '⑨ 검사기 갱신이 hold를 지움'; end if;
  -- ⑪ 대기 중 일반 수정(급구 토글 등, 다른 칸이 바뀜)은 hold를 유지
  update public.local_jobs set urgent = not coalesce(urgent, false) where id = 9302;
  if not coalesce((select ocr_check->>'inspect_hold' from public.local_jobs where id = 9302)::boolean, false) then raise exception '⑪ 일반 수정이 hold를 지움'; end if;
  -- ⑩ 고용주 등록은 anon/authenticated 권한으로 실행 — 해시 계산이 막히지 않게 트리거 함수는 security definer
  if not (select prosecdef from pg_proc where proname = 'enforce_job_inspect_current' and pronamespace = 'public'::regnamespace) then raise exception '⑩ 트리거 함수가 security definer가 아님'; end if;
  delete from public.local_jobs where id in (9301, 9302, 9303);
  raise notice 'inspect_gate_employer_legacy local test: 10개 경우 통과';
end $test$;

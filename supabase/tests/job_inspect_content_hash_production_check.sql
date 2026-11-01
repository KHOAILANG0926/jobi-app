-- 운영 점검(읽기 전용): 공개 강제 트리거가 있고, 내용 지문이 내용 변경에 반응하며 내용 외 칸에는 반응하지 않는다.
do $check$
declare
  a public.local_jobs;
  b public.local_jobs;
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_zzz_inspect_current' and not tgisinternal and tgenabled <> 'D'
  ) then raise exception 'trg_zzz_inspect_current 트리거 없음 또는 꺼짐'; end if;

  a := jsonb_populate_record(null::public.local_jobs,
    '{"title":"T","company":"C","salary":"26K/giờ","description":"Công việc A","source_text":"S","ocr_text":"O","images":["p.png"]}'::jsonb);
  b := a; b.description := 'Công việc B';
  if public.job_inspect_content_hash(a) = public.job_inspect_content_hash(b) then raise exception '상세요강 변경을 지문이 못 잡음'; end if;
  b := a; b.images := '["q.png"]'::jsonb;
  if public.job_inspect_content_hash(a) = public.job_inspect_content_hash(b) then raise exception '포스터 변경을 지문이 못 잡음'; end if;
  b := a; b.ocr_check := '{"x":1}'::jsonb; b.active := true;
  if public.job_inspect_content_hash(a) <> public.job_inspect_content_hash(b) then raise exception '내용 외 칸(ocr_check·active)에 지문이 반응함'; end if;
  raise notice 'job_inspect_content_hash production check passed';
end $check$;

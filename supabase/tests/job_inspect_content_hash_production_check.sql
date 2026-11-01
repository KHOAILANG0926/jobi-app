-- Read-only production regression check for content hash, fresh inspection, stale inspection.
do $test$
declare
  item public.local_jobs;
  baseline text;
  changed text;
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.local_jobs'::regclass
      and tgname = 'trg_zzz_inspect_current'
      and not tgisinternal
  ) then raise exception 'missing inspection publication trigger'; end if;

  item := jsonb_populate_record(null::public.local_jobs, '{"title":"role A","company":"Employer","salary":"26K/giờ","description":"Công việc A","source_text":"Source A","ocr_text":"OCR A","images":["poster-A.png"]}'::jsonb);
  baseline := public.job_inspect_content_hash(item);
  item.ocr_check := jsonb_build_object('inspect',jsonb_build_object('content_hash',baseline,'ok',true));
  if not public.job_inspect_is_current(item) then raise exception 'fresh, passing inspection rejected'; end if;
  item.description := 'Công việc B';
  changed := public.job_inspect_content_hash(item);
  if baseline = changed or public.job_inspect_is_current(item) then raise exception 'changed content was not invalidated'; end if;
  item.ocr_check := jsonb_build_object('inspect',jsonb_build_object('content_hash',changed,'ok',true));
  if not public.job_inspect_is_current(item) then raise exception 'new content inspection does not become current'; end if;
  item.ocr_check := jsonb_build_object('inspect',jsonb_build_object('content_hash',changed,'ok',false));
  if public.job_inspect_is_current(item) then raise exception 'failed inspection allowed'; end if;
  item.ocr_check := jsonb_build_object('inspect',jsonb_build_object('content_hash',changed,'ok',true));
  item.images := '["poster-B.png"]'::jsonb;
  if public.job_inspect_is_current(item) then raise exception 'changed poster was not invalidated'; end if;
  item.images := '["poster-A.png"]'::jsonb;
  item.ocr_text := 'OCR B';
  if public.job_inspect_is_current(item) then raise exception 'changed OCR was not invalidated'; end if;
  raise notice 'job_inspect_content_hash production check passed';
end $test$;

-- User-approved poster registration. Upload the original PNG first via ops-insert-job.yml.
-- No schema/policy/coordinate changes; real R7 machine OCR decides publication.
do $$
declare target bigint; found_count integer;
begin
  select count(*),min(id) into found_count,target from public.local_jobs
  where employer_phone='0975268614' and source='manual:poster:20261017-030142';
  if found_count<>1 then raise exception 'Expected one prepared poster record, found %',found_count; end if;
  update public.local_jobs set
    images='["vo-cuong/vo-cuong-20261017.png"]'::jsonb,
    image_url='https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/vo-cuong/vo-cuong-20261017.png',
    active=true,admin_hidden=false
  where id=target;
  -- R7 sets active=false until independently generated OCR matches this image.
end $$;
select id,title,active,admin_hidden,ocr_check->>'status' as ocr_status
from public.local_jobs where employer_phone='0975268614' and source='manual:poster:20261017-030142';

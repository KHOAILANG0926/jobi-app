-- Add the second user-provided original screenshot for independent R7 OCR.
-- Keep the original poster as the header image. Never write OCR verdicts here.
do $$
declare affected integer;
begin
  update public.local_jobs set images='["vo-cuong/vo-cuong-20261017.png","vo-cuong/vo-cuong-20261017-source.png"]'::jsonb,active=true
  where id=4827 and employer_phone='0975268614' and source='manual:poster:20261017-030142' and admin_hidden=false;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Expected exactly one prepared job'; end if;
end $$;
select id,active,ocr_check->>'status' as ocr_status from public.local_jobs where id=4827;

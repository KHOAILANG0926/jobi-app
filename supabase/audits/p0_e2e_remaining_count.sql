-- Synthetic P0 rows must be completely absent after the E2E finally block.
select
  (select count(*) from auth.users where raw_user_meta_data ->> 'e2e_marker' like 'VGB E2E P0 %')
  + (select count(*) from public.local_jobs where title like 'VGB E2E P0 %')
  + (select count(*) from public.applications where job_title like 'VGB E2E P0 %')
  + (select count(*) from public.interviews where job_title like 'VGB E2E P0 %')
  + (select count(*) from public.user_profiles where full_name like 'VGB E2E P0 %')
  + (select count(*) from public.user_cvs where cv_data::text like '%VGB E2E P0 %');

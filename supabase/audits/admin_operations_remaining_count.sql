select
  (select count(*) from public.local_jobs where title like 'VGB E2E ADMIN %')
  + (select count(*) from public.reports where snapshot::text like '%VGB E2E ADMIN %')
  + (select count(*) from public.admin_audit_logs where metadata::text like '%VGB E2E ADMIN %')
  as remaining_rows;

-- Run in a disposable/staging DB after installing the migration.
-- Must not be run in production: inserts use arbitrary fixture values.
begin;
do $$
declare
  sample public.local_jobs%rowtype;
begin
  -- The guard must be installed for ALL insert/update paths, not just the crawler.
  if not exists (select 1 from pg_trigger where tgrelid='public.local_jobs'::regclass
      and tgname='trg_zzzzz_verified_publication' and not tgisinternal) then
    raise exception 'Missing universal publication gate';
  end if;
  if has_table_privilege('service_role','job_publication_private.approvals','INSERT') then
    raise exception 'service_role can forge attestations';
  end if;
  if has_table_privilege('authenticated','job_publication_private.approvals','INSERT') then
    raise exception 'authenticated client can forge attestations';
  end if;
end $$;
rollback;

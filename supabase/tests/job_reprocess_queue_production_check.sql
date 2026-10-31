do $$ begin
if to_regclass('public.job_reprocess_queue') is null then raise exception 'job_reprocess_queue absent'; end if;
if (select relrowsecurity from pg_class where oid='public.job_reprocess_queue'::regclass) is not true then raise exception 'queue RLS missing'; end if;
if has_table_privilege('anon','public.job_reprocess_queue','INSERT') or has_table_privilege('authenticated','public.job_reprocess_queue','INSERT') then raise exception 'queue exposed to browser'; end if;
end $$;

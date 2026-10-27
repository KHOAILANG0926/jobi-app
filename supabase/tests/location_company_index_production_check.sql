-- Read-only ACL invariant for the two canonical company expression indexes.
do $$declare r text;begin
 for r in select unnest(array['authenticated','service_role']) loop
  if not has_function_privilege(r,'location_private.company_identity(text)','EXECUTE') then
   raise exception 'Company expression index helper is not executable by %',r;end if;
 end loop;
 for r in select unnest(array['anon','authenticated','service_role']) loop
  if has_schema_privilege(r,'location_private','USAGE')
   or has_function_privilege(r,'location_private.write_location(bigint,text,jsonb)','EXECUTE')
   or has_table_privilege(r,'public.job_work_locations','INSERT,UPDATE,DELETE,TRUNCATE') then
   raise exception 'Canonical source/private protection failed for %',r;end if;
 end loop;
 if exists(select 1 from public.location_integrity_issues()) then
  raise exception 'Canonical location source/cache integrity failed';end if;
end$$;

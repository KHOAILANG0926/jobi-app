-- Applied by migrations-apply with psql -1: all assertions and grants are atomic.
-- Index expressions run as the DML caller, even when the index uses a private
-- function OID. This pure normalizer needs EXECUTE; the private schema/writer
-- and canonical source table must remain inaccessible to application roles.
do $$begin
 if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('location_private.company_identity(text)')
  and p.provolatile='i' and not p.prosecdef and p.prorettype='text'::regtype) then
  raise exception 'Expected immutable invoker company_identity(text) is missing';
 end if;
 if to_regclass('public.location_job_company_identity') is null
  or to_regclass('public.location_candidate_company_identity') is null then
  raise exception 'Canonical company expression indexes are missing';
 end if;
 if exists(select 1 from public.location_integrity_issues()) then
  raise exception 'Canonical location integrity failed before index permission repair';
 end if;
end$$;
grant execute on function location_private.company_identity(text) to authenticated,service_role;
do $$declare r text;begin
 for r in select unnest(array['anon','authenticated','service_role']) loop
  if has_schema_privilege(r,'location_private','USAGE')
   or pg_has_role(r,'location_writer','MEMBER')
   or has_function_privilege(r,'location_private.write_location(bigint,text,jsonb)','EXECUTE')
   -- Enumerate built-in data-changing privileges, including whole-table
   -- clearing. Preserve pre-existing read/reference/trigger/maintenance ACLs;
   -- these are outside the canonical source DML revocation in the base SQL.
   or exists(select 1 from aclexplode(acldefault('r',0)) a
    where a.privilege_type not in ('SELECT','REFERENCES','TRIGGER','MAINTAIN')
     and has_table_privilege(r,'public.job_work_locations',a.privilege_type)) then
   raise exception 'Canonical write protection unexpectedly open for %',r;
  end if;
 end loop;
end$$;

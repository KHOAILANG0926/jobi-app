-- Production-safe, read-only verification; no fixed job ID or operational writes.
do $$
declare
  fn oid := to_regprocedure('public.admin_job_r7_read(bigint)');
  exposed boolean;
  definer boolean;
  locked boolean;
begin
  if fn is null then raise exception 'admin R7 read function missing'; end if;
  select p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=']
    into definer from pg_proc p where p.oid=fn;
  if not coalesce(definer,false) then
    raise exception 'admin R7 read must be stable security-definer with locked search_path';
  end if;
  select has_function_privilege('anon',fn,'EXECUTE')
      or has_function_privilege('service_role',fn,'EXECUTE')
    into exposed;
  if exposed then raise exception 'admin R7 read EXECUTE exposed to unapproved roles'; end if;
  if not has_function_privilege('authenticated',fn,'EXECUTE') then
    raise exception 'admin R7 read missing authenticated EXECUTE';
  end if;
  -- Calling without a session must deny even if the caller has database owner privilege.
  begin
    perform public.admin_job_r7_read(null::bigint);
    raise exception 'admin R7 read allowed missing session';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $t$ begin
 if (select count(*) from public.local_jobs where id in (4828,5421,5437) and admin_hidden) <> 3 then raise exception 'not hidden'; end if;
end $t$;

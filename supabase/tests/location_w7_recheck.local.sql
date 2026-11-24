do $t$ begin
 if not exists(select 1 from public.w7_requests where job_id=994001 and force) then raise exception 'public job without confirmed point not re-checked'; end if;
 if exists(select 1 from public.w7_requests where job_id in (994002,994003,994004,994005,994006)) then raise exception 'confirmed/private/hidden/no-row job re-checked: %', (select array_agg(job_id) from public.w7_requests where job_id<>994001); end if;
 if (select count(*) from public.w7_requests where job_id=994001) <> 1 then raise exception 'requested more than once'; end if;
end $t$;

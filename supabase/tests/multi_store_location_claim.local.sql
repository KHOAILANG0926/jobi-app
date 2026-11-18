do $t$ begin
 if (select count(*) from public.map_r1_claim_job_v2(990001, gen_random_uuid(), false)) <> 1 then raise exception 'store with unresolved row must be claimable'; end if;
 if (select count(*) from public.map_r1_claim_job_v2(990002, gen_random_uuid(), false)) <> 0 then raise exception 'fully located job must stay skipped'; end if;
 if not exists(select 1 from public.map_r1_requests where job_id=990001 and force) then raise exception 'unresolved store job not re-requested'; end if;
 if exists(select 1 from public.map_r1_requests where job_id=990002) then raise exception 'fully located job re-requested'; end if;
end $t$;

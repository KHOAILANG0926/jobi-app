do $t$ declare n int; begin
 if (select count(*) from public.map_r1_claim_job_v2(991001, gen_random_uuid(), false)) <> 0 then raise exception 'capped failure within a day must stay skipped (cap kept)'; end if;
 if (select count(*) from public.map_r1_claim_job_v2(991002, gen_random_uuid(), false)) <> 1 then raise exception 'capped failure older than a day must be claimable again'; end if;
 if (select count(*) from public.map_r1_claim_job_v2(991005, gen_random_uuid(), false)) <> 1 then raise exception 'call-capped failure older than a day must be claimable again'; end if;
 if (select count(*) from public.map_r1_claim_job_v2(991003, gen_random_uuid(), false)) <> 1 then raise exception 'uncapped failure after an hour must stay claimable'; end if;
 if (select count(*) from public.map_r1_claim_job_v2(991006, gen_random_uuid(), false)) <> 0 then raise exception 'failure within an hour must stay skipped'; end if;
 if (select count(*) from public.map_r1_claim_job_v2(991004, gen_random_uuid(), false)) <> 0 then raise exception 'real no-result (done) must not be re-claimed'; end if;
 perform public.map_r1_retry_pending();
 if exists(select 1 from public.map_r1_recheck_requests where job_id in (991001,991004)) then raise exception 'retry requested a capped-recent or done job'; end if;
 select count(*) into n from public.map_r1_recheck_requests where job_id in (991002,991003,991005,991006);
 if n <> 4 then raise exception 'retry must request old capped failures and uncapped failures, got %', n; end if;
end $t$;

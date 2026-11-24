-- 20261124140000: 장애로 실패 상한에 닿은 공고가 하루 뒤 다시 확인되는지(영구 제외 줄이 남아 있지 않은지) 확인.
do $t$ declare c text := pg_get_functiondef('public.map_r1_claim_job_v2(bigint,uuid,boolean)'::regprocedure);
 p text := pg_get_functiondef('public.map_r1_retry_pending()'::regprocedure);
begin
 if position('(r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval ''1 hour'')' in c) > 0 then raise exception 'claim still excludes capped failures forever'; end if;
 if position('(r.failures>=2 or r.calls>=2) and r.updated_at > now()-interval ''1 day''' in c) = 0 then raise exception 'claim daily recheck condition missing'; end if;
 if position('(s.failures >= 2 or s.calls >= 2))' in p) > 0 then raise exception 'retry still excludes capped failures forever'; end if;
 if position('(s.failures >= 2 or s.calls >= 2) and s.updated_at > now() - interval ''1 day''' in p) = 0 then raise exception 'retry daily recheck condition missing'; end if;
 if has_function_privilege('anon','public.map_r1_claim_job_v2(bigint,uuid,boolean)','execute') or has_function_privilege('authenticated','public.map_r1_claim_job_v2(bigint,uuid,boolean)','execute') then raise exception 'claim exposed'; end if;
 if has_function_privilege('anon','public.map_r1_retry_pending()','execute') or has_function_privilege('authenticated','public.map_r1_retry_pending()','execute') then raise exception 'retry exposed'; end if;
end $t$;

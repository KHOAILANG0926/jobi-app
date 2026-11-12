-- 20261112020000: 처리권이 핀 없는 다른 매장 줄을 막지 않는지(정확한 핀만 보고 돌아가는 옛 줄이 없는지) 확인.
do $t$ declare d text := pg_get_functiondef('public.map_r1_claim_job_v2(bigint,uuid,boolean)'::regprocedure);
begin
 if position('if public.map_r1_has_exact(p_id) then return; end if;' in d) > 0 then raise exception 'claim still skips jobs with unresolved stores'; end if;
 if position('point_kind=''unresolved''' in d) = 0 then raise exception 'claim unresolved-store condition missing'; end if;
 if has_function_privilege('anon','public.map_r1_claim_job_v2(bigint,uuid,boolean)','execute') or has_function_privilege('authenticated','public.map_r1_claim_job_v2(bigint,uuid,boolean)','execute') then raise exception 'claim exposed'; end if;
end $t$;

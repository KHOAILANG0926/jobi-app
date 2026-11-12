-- 2026-11-12 매장 여러 곳 공고(KRIK sb-5992·MediaMart sb-5994): 위치 찾기 처리권(map_r1_claim_job_v2)이
-- "정확한 핀이 하나라도 있으면 끝난 공고"로 보고 돌아가, 같은 공고의 못 찾은 다른 매장 줄(unresolved)을 다시 찾지 않았다.
-- 매장이 한 곳이던 때의 규칙이다. 이제 "정확한 핀이 있고, 핀 없는 줄도 없을 때만" 끝난 공고로 본다(Lee 2026-11-11 매장마다 핀, 지도 위치 절대 원칙).
-- map_r1_has_exact 자체는 바꾸지 않는다(공개 판정 applyLocationVerdict가 같은 뜻으로 쓰므로 공개 상태가 흔들리지 않게).
-- 함수 본문에서 그 줄만 바꾼다(앞 패치와 같은 방식). 줄이 없으면 RAISE로 전체 취소.
-- 끝으로, 지금 핀 없는 줄이 남은 공개 공고(정확한 핀이 있어 막혀 있던 것)만 위치 찾기를 한 번 다시 부른다(공고 번호 고정 없음).
--  Google·VietMap 호출은 기존 한도·저장 결과 재사용 규칙을 그대로 따른다.
begin;
do $patch$
declare definition text;
 old_line text := 'if public.map_r1_has_exact(p_id) then return; end if;';
 new_line text := 'if public.map_r1_has_exact(p_id) and not exists(select 1 from public.job_work_locations w where w.job_id=p_id and w.point_kind=''unresolved'') then return; end if;';
begin
 select pg_get_functiondef('public.map_r1_claim_job_v2(bigint,uuid,boolean)'::regprocedure) into definition;
 if position(old_line in definition) = 0 then raise exception 'claim exact-skip line not found in map_r1_claim_job_v2';end if;
 if position(old_line in substr(definition, position(old_line in definition) + 1)) > 0 then raise exception 'claim exact-skip line appears twice';end if;
 execute replace(definition, old_line, new_line);
end$patch$;
do $retry$
declare j record;
begin
 for j in select l.id from public.local_jobs l
   where l.active and not l.admin_hidden and public.map_r1_has_exact(l.id)
     and exists(select 1 from public.job_work_locations w where w.job_id=l.id and w.point_kind='unresolved')
   order by l.id limit 50
 loop
  perform public.map_r1_request_location(j.id, true);
 end loop;
end$retry$;
commit;

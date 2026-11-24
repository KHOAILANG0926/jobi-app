-- 지도 정상화 W3b (Lee 2026-11-24): 위치 찾기 'failed'는 외부 API 장애·저장소 오류로 '지금 확인 못 함'이다
-- (실제 '검색 결과 없음'은 done/unresolved — 그쪽 재확인 규칙·상한은 건드리지 않는다).
-- 지금은 같은 내용으로 실패 2번(또는 VietMap 호출 2번) 뒤에는 다시 확인하지 않아, 일시 장애가 지나가도 공고가 영구히 빠진다.
-- 상한(실패 2번·호출 2번)은 그대로 두고, 상한에 닿은 뒤에는 하루 지나서 한 번씩만 다시 확인하게 한다
-- (못 찾은 공고 재판정 map-r1-unlocated-retry와 같은 하루 주기. VietMap 호출 한도 map_r1_reserve_call·Google 월 한도는 그대로).
-- 함수 본문에서 그 조건만 바꾼다(20261112020000과 같은 방식). 줄이 없거나 두 번 있으면 RAISE로 전체 취소.
begin;
do $patch$
declare definition text; fn regprocedure; old_line text; new_line text; i int;
begin
 for i in 1..2 loop
  if i = 1 then
   fn := 'public.map_r1_claim_job_v2(bigint,uuid,boolean)'::regprocedure;
   old_line := '(r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval ''1 hour'')';
   new_line := '(r.updated_at > now()-interval ''1 hour'' or ((r.failures>=2 or r.calls>=2) and r.updated_at > now()-interval ''1 day''))';
  else
   fn := 'public.map_r1_retry_pending()'::regprocedure;
   old_line := 'not (s.state = ''failed'' and (s.failures >= 2 or s.calls >= 2))';
   new_line := 'not (s.state = ''failed'' and (s.failures >= 2 or s.calls >= 2) and s.updated_at > now() - interval ''1 day'')';
  end if;
  definition := pg_get_functiondef(fn);
  if position(old_line in definition) = 0 then raise exception 'failed-cap line not found in %', fn; end if;
  if position(old_line in substr(definition, position(old_line in definition) + 1)) > 0 then raise exception 'failed-cap line appears twice in %', fn; end if;
  execute replace(definition, old_line, new_line);
 end loop;
end$patch$;
commit;

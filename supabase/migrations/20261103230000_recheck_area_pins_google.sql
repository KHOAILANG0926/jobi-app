begin;
-- Lee 2026-11-03 "구글키는 있어": Google 단계가 기존 지도 키로 켜진 뒤(PR #442), 공개 공고 중 정확 핀 없이
-- 대략/공단 입구 핀만 있는 공고를 같은 위치 찾기(api/location-hook)로 다시 판정한다. 공고 번호 고정 없음.
-- 핀이 아예 없는 공고(원문에 위치 없음)는 다시 찾지 않는다(공개 상태를 바꾸지 않기 위해).
do $rerun$
declare j record; n int:=0;
begin
 for j in select l.id from public.local_jobs l
  where l.active and not l.admin_hidden
   and exists(select 1 from public.job_work_locations w where w.job_id=l.id and w.point_kind in ('area','gate'))
   and not exists(select 1 from public.job_work_locations w where w.job_id=l.id and w.point_kind='exact')
  order by l.id
 loop
  perform public.map_r1_request_location(j.id, true); n:=n+1;
 end loop;
 raise notice 'location re-check requested: %', n;
end$rerun$;
commit;

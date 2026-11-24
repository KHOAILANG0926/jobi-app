-- 지도 정상화 W7(Lee 2026-11-24): 확정 좌표가 없는 공개 공고의 위치를 기존 위치 찾기(Google → VietMap → Goong)로 한 번 다시 확인한다.
-- dry-run(ops-run-sql location-w7-restore-preview, Lee 실행 45438989778) 결과:
--  · 쓰기 기록으로 되돌릴 후보는 1건이었으나, 그 좌표의 근거가 다른 회사 위치를 가리켜(Goong 주소 검색 결과의 업체 이름이 공고 회사와 다름) 되돌리지 않는다.
--    잃기 전 좌표를 그대로 다시 쓰는 경로는 만들지 않는다 — 지금 위치 확인 규칙으로 다시 찾는다.
--  · 확정 좌표가 없는 공개 공고(대략 줄만 있음)는 예전 규칙이 Google 같은 이름 1곳을 대략 위치로 낮춘 결과로 보인다. 지금 규칙(Lee 2026-11-23)은 같은 결과를 확정으로 채택한다.
-- 방법: 20261112020000과 같다 — 규칙으로 고른 공고(번호 고정 없음)에 map_r1_request_location(id, true)를 부른다. 위치 쓰기는 기존 위치 찾기가 쓰기 함수로 한다.
--  Google·VietMap·Goong 호출은 기존 한도·저장 결과 재사용 규칙을 그대로 따른다. 못 찾으면 기존 보류·재확인 절차.
--  위치 보류함(location-hold)은 대상이 아니다(기존 retry_held). 공고 공개 상태·위치 줄은 이 파일이 직접 바꾸지 않는다.
begin;
do $recheck$
declare j record;
begin
 for j in select l.id from public.local_jobs l
   where l.active and not coalesce(l.admin_hidden, false)
     and exists(select 1 from public.job_work_locations w where w.job_id = l.id)
     and not exists(select 1 from public.job_work_locations w where w.job_id = l.id and w.lat is not null
                    and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse')))
   order by l.id limit 50
 loop
  perform public.map_r1_request_location(j.id, true);
 end loop;
end$recheck$;
commit;

-- 2026-10-20: 공단 표에 없는 공단(예: #4824 KCN Yên Phong)도 VietMap 공단 이름 검색으로 대략 위치 핀을 찾게 고쳤다(src/lib/parkLocate.ts).
-- 이미 '못 찾음'으로 끝난 공개 공고를 새 코드로 한 번 다시 찾게 한다(기존 map_r1_rejudge_once 재사용, 끝나면 스스로 예약 해제).
-- 데이터를 지우거나 공개 상태를 바꾸지 않는다(위치 찾기 요청만).
update public.map_r1_rejudge_marker set since = now() where id = 1;
insert into public.map_r1_rejudge_marker(id, since) select 1, now() where not exists (select 1 from public.map_r1_rejudge_marker where id = 1);
select cron.unschedule('map-r1-rejudge-once') where exists (select 1 from cron.job where jobname = 'map-r1-rejudge-once');
select cron.schedule('map-r1-rejudge-once', '*/10 * * * *', 'select public.map_r1_rejudge_once()');

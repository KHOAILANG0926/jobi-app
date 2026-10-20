-- 2026-10-20 2차: 같은 이름 공단 결과가 둘일 때 공단 POI를 고르도록 고친 뒤, 못 찾은 공개 공고를 한 번 더 다시 찾게 한다(위치 찾기 요청만).
update public.map_r1_rejudge_marker set since = now() where id = 1;
insert into public.map_r1_rejudge_marker(id, since) select 1, now() where not exists (select 1 from public.map_r1_rejudge_marker where id = 1);
select cron.unschedule('map-r1-rejudge-once') where exists (select 1 from cron.job where jobname = 'map-r1-rejudge-once');
select cron.schedule('map-r1-rejudge-once', '*/10 * * * *', 'select public.map_r1_rejudge_once()');

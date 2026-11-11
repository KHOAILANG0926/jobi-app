-- 시험 DB 확인: 좌표 없는 쓰기가 성 중심 핀(area)을 만들지 않는다.
do $$begin if location_private.write_location(1,'upsert','{"address":"Bắc Ninh"}')<>0 then raise exception 'administrative pin still created';end if;end$$;

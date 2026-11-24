-- 시험 DB 확인(폐기용 DB): 같은 지점 표기 차이는 확정 줄을 쓰고, 그 외는 기존 동작 그대로.
do $$declare n bigint; a text; c int;begin
 -- 1) 지역 덧붙임만 다른 같은 지점 → 기존 확정 줄 사용, 주소 글자 그대로
 n:=location_private.write_location(990101,'upsert','{"address":"152 Trần Hưng Đạo"}');
 if n<>9901011 then raise exception 'same store confirmed row not reused: %',n;end if;
 select raw_address into a from public.job_work_locations where id=9901011;
 if a<>'152 Trần Hưng Đạo, TP. Bắc Ninh, Bắc Ninh' then raise exception 'confirmed address rewritten: %',a;end if;
 -- 2) 확정이 아닌 줄은 기존 동작(새 줄)
 n:=location_private.write_location(990102,'upsert','{"address":"Số 1 Lê Lợi"}');
 if n=9901021 then raise exception 'unconfirmed row must keep old behavior';end if;
 -- 3) 다른 지점(포함 관계 아님) → 새 줄, 확정 줄 그대로
 n:=location_private.write_location(990101,'upsert','{"address":"99 Lý Thái Tổ, Bắc Ninh"}');
 if n=9901011 then raise exception 'different branch matched confirmed row';end if;
 -- 4) 후보가 2줄이면 모호 → 새 줄(회사 이름·부분 일치만으로 합치지 않음)
 n:=location_private.write_location(990103,'upsert','{"address":"12 Nguyễn Trãi"}');
 if n in (9901031,9901032) then raise exception 'ambiguous match must not pick a row';end if;
 -- 5) 줄 지정 쓰기(work_location_id)는 그대로 검사
 begin perform location_private.write_location(990101,'upsert','{"address":"152 Trần Hưng Đạo","work_location_id":1}');raise exception 'stale target not checked';
 exception when others then if sqlerrm<>'stale target' then raise; end if; end;
end$$;

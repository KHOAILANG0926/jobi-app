-- Lee 2026-11-11 지도 위치 절대 원칙 "지도 위치를 모르면 마음대로 찍지 마"(CLAUDE.md): 위치 쓰기 함수(write_location)가
-- 좌표 없는 근무지 줄에 성·시 중심 대략 핀을 자동으로 찍던 단계(20261028050507, 20261029120000 원문 확인 규칙 포함)를 지운다.
-- 이제 좌표 없는 줄은 좌표 없이 남는다(위치 찾기가 찾은 곳만 핀). 이미 있는 핀은 이 파일에서 바꾸지 않는다.
-- 함수 본문에서 그 단계만 잘라낸다(새 쓰기 경로를 만들지 않음, 앞 패치와 같은 방식). 단계가 없으면 RAISE로 전체 취소.
begin;
do $patch$
declare migration_role text:=current_user;
 original_set boolean:=pg_has_role(current_user,'location_writer','SET');
 original_memberships jsonb:=(select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=current_user::regrole);
 original_create boolean:=has_schema_privilege('location_writer','location_private','CREATE');
 definition text; s int; e int;
 start_mark text := ' -- A missing point is an approximate administrative area until admin review.';
 end_mark text := ' if w.id is null then';
begin
 if not original_set then execute format('grant location_writer to %I with inherit false, set true',migration_role);end if;
 if not original_create then grant create on schema location_private to location_writer;end if;
 select pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure) into definition;
 s := position(start_mark in definition);
 if s = 0 or position('location_private.administrative_area(addr)' in definition) = 0 then raise exception 'administrative area pin step not found in write_location';end if;
 e := s + position(end_mark in substr(definition, s)) - 1;
 if e < s or position('location_private.administrative_area(' in substr(definition, e)) > 0 then raise exception 'administrative area pin step boundary unclear';end if;
 definition := substr(definition, 1, s - 1) || ' -- 2026-11-11: 좌표 없는 줄에 성·시 중심 핀을 찍지 않는다(지도 위치 절대 원칙).' || chr(10) || substr(definition, e);
 execute 'set local role location_writer';
 execute definition;
 execute format('set local role %I',migration_role);
 if not original_create then revoke create on schema location_private from location_writer;end if;
 if not original_set then execute format('revoke location_writer from %I',migration_role);end if;
 if has_schema_privilege('location_writer','location_private','CREATE') is distinct from original_create
 or (select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=migration_role::regrole) is distinct from original_memberships then raise exception 'temporary writer permissions not restored';end if;
end$patch$;
commit;

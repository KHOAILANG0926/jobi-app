-- 지도 정상화 A(Lee 2026-11-24): 재수집·갱신이 주소 표기 차이만으로 기존 확정 위치를 잃지 않게 한다.
-- 원인: write_location이 기존 줄을 admin_location_key 완전 일치로만 찾는다. 기존 줄은 지역을 덧붙여 저장돼("…, TP. Bắc Ninh, Bắc Ninh")
--   재수집 글자와 열쇠가 다르면 새 줄로 취급 → 'replace'가 기존 확정 줄을 지우고(retained_rows에만 남음) 확정 좌표·근거가 사라진다.
-- 고침: 완전 일치 줄이 없을 때만, 이미 쓰고 있는 같은 매장 규칙(낱말 단위 포함 — src/lib/addressReader.sameStore·crawler/pin_guard._same)을
--   '지역 덧붙임' 모양으로 좁혀 적용해 같은 지점의 확정 줄(관리자 확정·재사용·검증 좌표)을 찾아 그 줄을 갱신한다.
--   · 한쪽이 다른 쪽의 낱말 단위 앞부분이고(뒤에 지역만 덧붙은 표기 차이), 짧은 쪽에 번지 숫자가 있을 때만. 거리 이름만 있는 주소는
--     번지 있는 주소와 같은 지점으로 보지 않는다(같은 거리의 다른 지점·12번지≠112번지).
--   · 거기에 더해 후보가 정확히 1줄이고 그 줄이 확정일 때만(후보 수는 필요조건일 뿐 충분조건이 아님, 회사 이름 일치만으로는 같은 지점이 아님, 모호하면 기존대로 새 줄).
--   · 그때 주소는 기존 확정 줄의 글자를 그대로 둔다(열쇠가 바뀌면 확정 근거 재검증이 풀리므로).
--   · 확정이 아닌 줄·무효화(invalidate)·가져오기(import)·줄 지정(work_location_id) 쓰기는 그대로. 실제 다른 지점·이전은 기존 정책 그대로.
-- 새 유사도 알고리즘·정규화 없음. 함수 본문에서 줄 찾기 한 곳 뒤에만 덧붙인다(앞 패치와 같은 방식). 찾는 줄이 없으면 RAISE로 전체 취소.
begin;
do $patch$
declare migration_role text:=current_user;
 original_set boolean:=pg_has_role(current_user,'location_writer','SET');
 original_memberships jsonb:=(select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=current_user::regrole);
 original_create boolean:=has_schema_privilege('location_writer','location_private','CREATE');
 definition text; s int;
 anchor text := 'and public.admin_location_key(raw_address)=public.admin_location_key(addr) order by sort_order,id limit 1 for update;';
 ak text := 'public.admin_location_key(addr)';
 xk text := 'public.admin_location_key(x.raw_address)';
 pred text; addition text;
begin
 pred := xk || $q$<>'' and (starts_with($q$ || xk || $q$||' ',$q$ || ak || $q$||' ') or starts_with($q$ || ak || $q$||' ',$q$ || xk || $q$||' '))$q$
  || $q$ and (case when length($q$ || ak || $q$)<=length($q$ || xk || $q$) then $q$ || ak || ' else ' || xk || $q$ end) ~ '[0-9]'$q$;
 addition := chr(10) || ' -- 2026-11-24: 같은 지점의 확정 줄은 주소 표기(지역 덧붙임) 차이로 놓치지 않는다(같은 매장 규칙을 앞부분 일치+번지 숫자로 좁힘, 후보 1줄·확정 줄만).' || chr(10)
  || ' if w.id is null and p_operation=''upsert'' and not(p_payload ? ''work_location_id'') and ' || ak || '<>'''' and (select count(*) from public.job_work_locations x where x.job_id=p_job_id and ' || pred || ')=1 then' || chr(10)
  || '  select * into w from public.job_work_locations x where x.job_id=p_job_id and ' || pred || ' for update;' || chr(10)
  || '  if w.location_verified or w.point_authority in (''admin_confirmed'',''auto_reuse'') then addr:=w.raw_address; else w:=null; end if;' || chr(10)
  || ' end if;';
 if not original_set then execute format('grant location_writer to %I with inherit false, set true',migration_role);end if;
 if not original_create then grant create on schema location_private to location_writer;end if;
 select pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure) into definition;
 s := position(anchor in definition);
 if s = 0 or position(anchor in substr(definition, s + 1)) > 0 then raise exception 'existing-row lookup not found exactly once in write_location';end if;
 definition := substr(definition, 1, s + length(anchor) - 1) || addition || substr(definition, s + length(anchor));
 execute 'set local role location_writer';
 execute definition;
 execute format('set local role %I',migration_role);
 if not original_create then revoke create on schema location_private from location_writer;end if;
 if not original_set then execute format('revoke location_writer from %I',migration_role);end if;
 if has_schema_privilege('location_writer','location_private','CREATE') is distinct from original_create
 or (select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=migration_role::regrole) is distinct from original_memberships then raise exception 'temporary writer permissions not restored';end if;
end$patch$;
commit;

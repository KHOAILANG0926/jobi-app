-- 로컬 Supabase 전용 검증 스크립트 — Production에서 실행하지 않는다.
-- 실행: docker exec -i supabase_db_<project> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/job_alerts_rls_test.sql
-- 전체가 하나의 트랜잭션이고 마지막에 ROLLBACK하므로 반복 실행 가능하다.
-- 실패하면 exception으로 중단되고, 성공하면 각 항목마다 'PASS ...' NOTICE가 찍힌다.

\set ON_ERROR_STOP 1
begin;

-- ---------------------------------------------------------------- 준비 (postgres)
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rls-test-seeker-a@test.invalid', '{"role":"seeker"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'rls-test-seeker-b@test.invalid', '{"role":"seeker"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', 'rls-test-employer@test.invalid', '{"role":"employer"}', '{}', now(), now());

-- 공고: id 고정. 집(A) 좌표 = (10.776, 106.700) 근처.
insert into public.local_jobs (id, title, company, category, location, recruitment_regions, application_deadline, active, admin_hidden,
  salary_min, salary_max, salary_currency, salary_period, salary_negotiable, shift_type, work_start_time, work_end_time, created_at)
values
  (901, 'J1 all match', 'C', 'am_thuc_do_uong', 'Quận 1, TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (902, 'J2 Hanoi', 'C', 'am_thuc_do_uong', 'Cầu Giấy, Hà Nội', '{Hà Nội}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (903, 'J3 negotiable', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, null, null, null, null, true, null, null, null, now()),
  (904, 'J4 inactive', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, false, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (905, 'J5 expired', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date - 1, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (906, 'J6 no region', 'C', 'am_thuc_do_uong', '', '{}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (907, 'J7 admin hidden', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, true, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (908, 'J8 Vinh Long', 'C', 'am_thuc_do_uong', 'Vĩnh Long', '{Vĩnh Long}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (909, 'J9 straddles', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, 8000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (910, 'J10 rotating', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'rotating', null, null, now()),
  (911, 'J11 old job', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now() - interval '1 hour'),
  (912, 'J12 other category', 'C', 'van_phong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (913, 'J13 low salary', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 10, true, false, 6000000, 8000000, 'VND', 'month', false, 'day', '08:00', '17:00', now()),
  (914, 'J14 deadline today', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', (now() at time zone 'Asia/Ho_Chi_Minh')::date, true, false, 10000000, 12000000, 'VND', 'month', false, 'day', '08:00', '17:00', now());

insert into public.job_work_locations (job_id, raw_address, lat, lng, coordinate_accuracy, location_verified, resolved_province)
values
  (901, '12 Lê Lợi, Quận 1, TP.HCM', 10.7760, 106.7010, 'exact', false, 'Thành phố Hồ Chí Minh'),
  (909, 'Thủ Đức, TP.HCM', 10.85, 106.77, 'ward', false, 'Thành phố Hồ Chí Minh');

do $$ begin raise notice 'setup done'; end $$;

-- ---------------------------------------------------------------- A: 구직자 A로 전환
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 거리조건은 집 위치(동의) 없이는 저장 불가
do $$ begin
  begin
    insert into public.job_alert_preferences (name, region_ids, region_importance, max_distance_km, distance_importance)
    values ('x', '{hcm}', 'required', 10, 'preferred');
    raise exception 'FAIL distance without home was allowed';
  exception when others then
    if sqlerrm not like '%job_alert_home_location_required%' then raise; end if;
  end;
  raise notice 'PASS distance condition requires consented home location';
end $$;

-- 필수조건 없는 조건 저장 불가
do $$ begin
  begin
    insert into public.job_alert_preferences (name, region_ids, region_importance) values ('x', '{hcm}', 'preferred');
    raise exception 'FAIL preference without any required criterion was allowed';
  exception when check_violation then null;
  end;
  raise notice 'PASS at least one required criterion enforced';
end $$;

-- 집 위치: 정밀 좌표를 보내도 소수 3자리(~100m)로 저장
insert into public.job_alert_home_locations (lat, lng) values (10.776543, 106.700987);
do $$ declare r record; begin
  select * into r from public.job_alert_home_locations;
  if r.lat <> 10.777 or r.lng <> 106.701 then raise exception 'FAIL home not rounded: % %', r.lat, r.lng; end if;
  if r.seeker_id <> '00000000-0000-0000-0000-00000000000a' then raise exception 'FAIL home owner'; end if;
  raise notice 'PASS home coordinates rounded to 3 decimals and owned by A';
end $$;

with ins as (insert into public.job_alert_preferences (name, region_ids, region_importance, categories, category_importance,
  salary_min, salary_period, salary_importance, work_start, work_end, hours_importance, max_distance_km, distance_importance)
values ('A main', '{hcm}', 'required', '{am_thuc_do_uong}', 'required',
  10000000, 'month', 'required', '07:00', '18:00', 'preferred', 10, 'preferred') returning id)
select set_config('test.pref_a', id::text, true) from ins;

-- 매칭 결과 판정
do $$
declare
  v jsonb;
  function_result record;
  m jsonb := '{}'::jsonb;
begin
  for function_result in select * from public.job_alert_match_jobs(current_setting('test.pref_a')::uuid) loop
    m := m || jsonb_build_object(function_result.job_id::text, function_result.result);
  end loop;

  if m->'901'->>'overall' <> 'match' then raise exception 'FAIL J1 %', m->'901'; end if;
  if (m->'901'->>'preferred_met')::int <> 2 then raise exception 'FAIL J1 preferred %', m->'901'; end if;
  if m->'902'->>'overall' <> 'mismatch' or m->'902'->'criteria'->'region'->>'reason' <> 'region_other' then raise exception 'FAIL J2 %', m->'902'; end if;
  if m->'903'->>'overall' <> 'unknown' or m->'903'->'criteria'->'salary'->>'reason' <> 'salary_negotiable' then raise exception 'FAIL J3 %', m->'903'; end if;
  if m ? '904' then raise exception 'FAIL inactive job returned'; end if;
  if m ? '905' then raise exception 'FAIL expired job returned'; end if;
  if m->'906'->>'overall' <> 'unknown' or m->'906'->'criteria'->'region'->>'reason' <> 'region_missing' then raise exception 'FAIL J6 %', m->'906'; end if;
  if m ? '907' then raise exception 'FAIL admin hidden job returned'; end if;
  if m->'908'->'criteria'->'region'->>'status' <> 'mismatch' then raise exception 'FAIL J8 %', m->'908'; end if;
  if m->'909'->>'overall' <> 'unknown' or m->'909'->'criteria'->'salary'->>'reason' <> 'salary_range_straddles' then raise exception 'FAIL J9 %', m->'909'; end if;
  -- J9 좌표는 ward+미검증 → 거리 추정 안 함
  if m->'909'->'criteria'->'distance'->>'status' <> 'unknown' then raise exception 'FAIL J9 distance %', m->'909'; end if;
  if m->'910'->'criteria'->'hours'->>'status' <> 'mismatch' then raise exception 'FAIL J10 %', m->'910'; end if;
  if m->'910'->>'overall' <> 'match' then raise exception 'FAIL J10 overall (hours is preferred) %', m->'910'; end if;
  if m->'912'->>'overall' <> 'mismatch' or m->'912'->'criteria'->'category'->>'reason' <> 'category_other' then raise exception 'FAIL J12 %', m->'912'; end if;
  if m->'913'->>'overall' <> 'mismatch' or m->'913'->'criteria'->'salary'->>'reason' <> 'salary_below' then raise exception 'FAIL J13 %', m->'913'; end if;
  if m->'914'->>'overall' <> 'match' then raise exception 'FAIL J14 deadline today should be open %', m->'914'; end if;
  if m->'903'->'criteria'->'distance'->>'reason' <> 'distance_job_coordinate_missing' then raise exception 'FAIL J3 distance %', m->'903'; end if;
  raise notice 'PASS verdicts: match / mismatch / unknown per criterion, closed/inactive/hidden excluded';
end $$;

-- 클라이언트는 알림을 직접 만들 수 없고, 배치 함수도 실행할 수 없다
do $$ begin
  begin
    insert into public.job_alert_notifications (seeker_id, preference_id, job_id, result)
    values ('00000000-0000-0000-0000-00000000000a', current_setting('test.pref_a')::uuid, 901, '{}');
    raise exception 'FAIL client inserted notification';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.job_alert_generate_notifications();
    raise exception 'FAIL client ran generator';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS client cannot insert notifications or run generator';
end $$;

-- ---------------------------------------------------------------- B: 구직자 B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

with ins as (insert into public.job_alert_preferences (name, region_ids, region_importance)
values ('B hanoi', '{hanoi}', 'required') returning id)
select set_config('test.pref_b', id::text, true) from ins;

do $$ declare n int; begin
  select count(*) into n from public.job_alert_preferences;
  if n <> 1 then raise exception 'FAIL B sees % preferences', n; end if;
  select count(*) into n from public.job_alert_home_locations;
  if n <> 0 then raise exception 'FAIL B sees A home'; end if;
  update public.job_alert_preferences set name = 'hacked' where id = current_setting('test.pref_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B updated A preference'; end if;
  delete from public.job_alert_preferences where id = current_setting('test.pref_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B deleted A preference'; end if;
  delete from public.job_alert_home_locations where seeker_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B deleted A home'; end if;
  begin
    perform * from public.job_alert_match_jobs(current_setting('test.pref_a')::uuid);
    raise exception 'FAIL B evaluated A preference';
  exception when no_data_found then null;
  end;
  raise notice 'PASS seeker B cannot read/update/delete/evaluate seeker A data';
end $$;

-- B가 seeker_id를 A로 지정해 끼워넣기 → 컬럼 권한 없음
do $$ begin
  begin
    insert into public.job_alert_preferences (seeker_id, name, region_ids, region_importance)
    values ('00000000-0000-0000-0000-00000000000a', 'spoof', '{hcm}', 'required');
    raise exception 'FAIL spoofed seeker_id insert allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS cannot insert preference for another seeker';
end $$;

-- ---------------------------------------------------------------- 기업 E
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
do $$ declare n int; begin
  begin
    insert into public.job_alert_preferences (name, region_ids, region_importance) values ('emp', '{hcm}', 'required');
    raise exception 'FAIL employer created preference';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.job_alert_preferences;
  if n <> 0 then raise exception 'FAIL employer sees preferences'; end if;
  select count(*) into n from public.job_alert_home_locations;
  if n <> 0 then raise exception 'FAIL employer sees home locations'; end if;
  raise notice 'PASS employer cannot create or read seeker preferences/locations';
end $$;

-- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform 1 from public.job_alert_preferences;
    raise exception 'FAIL anon read preferences';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS anon has no access';
end $$;

-- ---------------------------------------------------------------- 배치 (cron = postgres)
reset role;
-- 배치는 DB 전체 조건을 처리하므로, 다른 로컬 데이터가 있어도 되도록 이 테스트의
-- 두 조건(A, B)에 대한 알림 수만 센다.
create or replace function pg_temp.test_notif_count() returns int language sql as $$
  select count(*)::int from public.job_alert_notifications
  where preference_id in (current_setting('test.pref_a')::uuid, current_setting('test.pref_b')::uuid);
$$;

do $$ declare n int; before int; ids bigint[]; begin
  before := pg_temp.test_notif_count();
  perform public.job_alert_generate_notifications();
  n := pg_temp.test_notif_count() - before;
  select array_agg(job_id order by job_id) into ids from public.job_alert_notifications
    where preference_id = current_setting('test.pref_a')::uuid;
  -- J1, J10(시간은 선호), J14(마감 당일) 만. J11은 조건 생성 전 공고라 제외.
  if ids is distinct from array[901, 910, 914]::bigint[] then raise exception 'FAIL A notifications %', ids; end if;
  select array_agg(job_id order by job_id) into ids from public.job_alert_notifications
    where preference_id = current_setting('test.pref_b')::uuid;
  if ids is distinct from array[902]::bigint[] then raise exception 'FAIL B notifications %', ids; end if;
  if n <> 4 then raise exception 'FAIL inserted count %', n; end if;
  raise notice 'PASS generator: only fully-confirmed required matches, closed/hidden/inactive/old excluded';

  before := pg_temp.test_notif_count();
  perform public.job_alert_generate_notifications();
  n := pg_temp.test_notif_count() - before;
  if n <> 0 then raise exception 'FAIL duplicate notifications on rerun: %', n; end if;
  raise notice 'PASS rerun creates no duplicates';

  -- 정보 미확인이던 J6가 나중에 지역 정보를 얻으면 다음 배치에서 1회 알림
  insert into public.job_work_locations (job_id, raw_address, resolved_province) values (906, 'Gò Vấp, TP.HCM', 'Thành phố Hồ Chí Minh');
  before := pg_temp.test_notif_count();
  perform public.job_alert_generate_notifications();
  n := pg_temp.test_notif_count() - before;
  if n <> 1 then raise exception 'FAIL J6 after location resolved: %', n; end if;
  before := pg_temp.test_notif_count();
  perform public.job_alert_generate_notifications();
  if pg_temp.test_notif_count() <> before then raise exception 'FAIL J6 duplicated'; end if;
  raise notice 'PASS unknown job alerted once after info became available';

  -- 중지된 조건은 알림 없음
  update public.job_alert_preferences set status = 'paused' where id = current_setting('test.pref_a')::uuid;
  insert into public.local_jobs (id, title, company, category, location, recruitment_regions, application_deadline,
    salary_min, salary_max, salary_currency, salary_period, salary_negotiable, created_at)
  values (915, 'J15 while paused', 'C', 'am_thuc_do_uong', 'TP.HCM', '{Hồ Chí Minh}', current_date + 5,
    11000000, 13000000, 'VND', 'month', false, now());
  perform public.job_alert_generate_notifications();
  if exists (select 1 from public.job_alert_notifications where job_id = 915 and preference_id = current_setting('test.pref_a')::uuid)
  then raise exception 'FAIL paused preference notified'; end if;
  raise notice 'PASS paused preference gets no notifications';

  -- 정지(suspended) 계정은 알림 없음
  update public.account_statuses set status = 'suspended' where user_id = '00000000-0000-0000-0000-00000000000b';
  insert into public.local_jobs (id, title, company, category, location, recruitment_regions, application_deadline, created_at)
  values (916, 'J16 hanoi', 'C', 'am_thuc_do_uong', 'Hà Nội', '{Hà Nội}', current_date + 5, now());
  perform public.job_alert_generate_notifications();
  if exists (select 1 from public.job_alert_notifications where job_id = 916 and preference_id = current_setting('test.pref_b')::uuid) then raise exception 'FAIL suspended seeker notified'; end if;
  update public.account_statuses set status = 'active' where user_id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'PASS suspended seeker gets no notifications';
end $$;

-- ---------------------------------------------------------------- 알림 읽음/숨김 격리
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from public.job_alert_notifications where seeker_id <> auth.uid();
  if n <> 0 then raise exception 'FAIL B sees % notifications of others', n; end if;
  select count(*) into n from public.job_alert_notifications where preference_id = current_setting('test.pref_b')::uuid;
  if n <> 1 then raise exception 'FAIL B sees % own test notifications', n; end if;
  update public.job_alert_notifications set read_at = now() where preference_id = current_setting('test.pref_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B marked A notifications'; end if;
  raise notice 'PASS seeker B cannot see or mark seeker A notifications';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$ declare n int; begin
  update public.job_alert_notifications set read_at = now(), dismissed_at = now() where job_id = 901;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL A could not mark own notification'; end if;
  begin
    update public.job_alert_notifications set job_id = 902 where job_id = 901;
    raise exception 'FAIL A changed notification job_id';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.job_alert_notifications where job_id = 901;
    raise exception 'FAIL A deleted notification (would break dedup)';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS owner can mark read/dismiss only; cannot delete or rewrite';
end $$;

-- 동의 철회 → 거리 조건은 unknown(home_missing)으로
do $$ declare r jsonb; begin
  update public.job_alert_preferences set status = 'active' where id = current_setting('test.pref_a')::uuid;
  delete from public.job_alert_home_locations;
  select result into r from public.job_alert_match_jobs(current_setting('test.pref_a')::uuid) where job_id = 901;
  if r->'criteria'->'distance'->>'reason' <> 'distance_home_missing' then raise exception 'FAIL after consent withdrawal %', r; end if;
  raise notice 'PASS consent withdrawal deletes location; distance becomes unknown';
end $$;

-- 최대 5개
do $$ begin
  insert into public.job_alert_preferences (name, region_ids, region_importance) select 'n' || g, '{hcm}', 'required' from generate_series(1, 4) g;
  begin
    insert into public.job_alert_preferences (name, region_ids, region_importance) values ('six', '{hcm}', 'required');
    raise exception 'FAIL 6th preference allowed';
  exception when others then
    if sqlerrm not like '%job_alert_limit_reached%' then raise; end if;
  end;
  raise notice 'PASS max 5 preferences per seeker';
end $$;

reset role;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'job-alert-notifications' and schedule = '*/15 * * * *') then
    raise exception 'FAIL cron not scheduled';
  end if;
  raise notice 'PASS cron job-alert-notifications scheduled every 15 minutes';
end $$;

rollback;

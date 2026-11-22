-- 시험 DB 전용 확인: (A) 실제 함수가 지금 시각 기준 베트남 날짜로 만료 처리한다 (B) 시각 격자(96시각 × 마감일 13개)에서 실제 함수 본문(now()만 고정 시각)의 결과가
-- 함수와 독립인 기준(마감일 >= UTC+7시간의 날짜면 열림)과 모두 일치하고, 옛 기준(now()::date)으로 바꾼 복사본은 UTC 17~24시에 어긋난다.
do $check$
declare
  vn date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  got boolean[];
  n int;
  def text;
  t timestamptz;
  which int;
  bad_old int := 0;
begin
  -- (0) 함수 본문이 베트남 날짜 기준이다(시각과 무관하게 항상 검사 — 옛 기준이면 여기서 실패)
  if pg_get_functiondef('public.deactivate_expired_jobs()'::regprocedure) not like '%Asia/Ho_Chi_Minh%' then
    raise exception 'deactivate_expired_jobs가 베트남 날짜 기준이 아님';
  end if;
  -- (A) 실제 함수 — 시각과 상관없이 마감일이 베트남 오늘보다 앞선 것만 닫힌다(마감 당일·내일·마감 없음은 그대로)
  delete from public.local_jobs where id between 91001 and 91005;
  insert into public.local_jobs(id, company, location, active, application_deadline) values
    (91001, 't', 't', true, vn - 2), (91002, 't', 't', true, vn - 1), (91003, 't', 't', true, vn),
    (91004, 't', 't', true, vn + 1), (91005, 't', 't', true, null);
  perform public.deactivate_expired_jobs();
  select array_agg(active order by id) into got from public.local_jobs where id between 91001 and 91005;
  if got is distinct from array[false, false, true, true, true] then
    raise exception '만료 처리 결과 이상: % (기대: 이틀 전·어제 닫힘, 오늘·내일·없음 유지)', got;
  end if;
  delete from public.local_jobs where id between 91001 and 91005;

  -- (B) 시각 격자: 실제 함수 본문(pg_get_functiondef)의 now()만 고정 시각으로 바꾼 복사본을 시각마다 실행하고,
  --     결과를 함수와 무관한 기준(마감일 >= 베트남 오늘이면 열림, 베트남 오늘 = UTC 시각 + 7시간 — 시간대 이름·함수 식을 쓰지 않는 산술)과 비교한다.
  --     옛 기준(now()::date, DB 시간대 UTC)으로 바꾼 복사본은 같은 격자에서 어긋나야 한다(시험이 실제 날짜 경계 오류를 잡는다는 증명).
  def := pg_get_functiondef('public.deactivate_expired_jobs()'::regprocedure);
  if (length(def) - length(replace(def, 'now()', ''))) / 5 <> 1 then raise exception '함수 본문에 now()가 정확히 1번이 아님 — 시험 복사본을 만들 수 없음'; end if;
  execute replace(replace(def, 'public.deactivate_expired_jobs()', 'pg_temp.dx_real()'), 'now()', $$current_setting('dx.now')::timestamptz$$);
  execute replace(replace(replace(def, 'public.deactivate_expired_jobs()', 'pg_temp.dx_old()'), '(now() at time zone ''Asia/Ho_Chi_Minh'')::date', 'now()::date'), 'now()', $$current_setting('dx.now')::timestamptz$$);
  if pg_get_functiondef('pg_temp.dx_old()'::regprocedure) like '%Asia/Ho_Chi_Minh%' then raise exception '옛 기준 복사본을 만들지 못함'; end if;
  set local timezone = 'UTC'; -- 옛 기준은 DB 시간대(운영 UTC)의 날짜였다
  for t in select generate_series(timestamptz '2026-11-20 00:00+00', timestamptz '2026-11-23 23:00+00', interval '1 hour') loop
    for which in 1..2 loop
      delete from public.local_jobs where id between 91101 and 91113;
      insert into public.local_jobs(id, company, location, active, application_deadline)
        select 91101 + k, 't', 't', true, date '2026-11-18' + k from generate_series(0, 12) k;  -- 마감일 11-18 ~ 11-30
      perform set_config('dx.now', t::text, true);
      if which = 1 then perform pg_temp.dx_real(); else perform pg_temp.dx_old(); end if;
      -- 함수와 무관한 기준: 베트남 오늘 = (UTC 시각 + 7시간)의 날짜, 마감일 >= 베트남 오늘이면 열림
      select count(*) into n from public.local_jobs
       where active is distinct from (application_deadline >= (((t at time zone 'UTC') + interval '7 hours')::date))
         and id between 91101 and 91113;
      if which = 1 and n > 0 then
        raise exception '실제 함수가 베트남 날짜 기준과 어긋남: 시각 % UTC, %건', t, n;
      elsif which = 2 and n > 0 then
        bad_old := bad_old + 1;
        if not (extract(hour from t at time zone 'UTC') >= 17) then raise exception '옛 기준 복사본이 UTC 17시 이전에 어긋남(예상 밖): %', t; end if;
      end if;
    end loop;
  end loop;
  delete from public.local_jobs where id between 91101 and 91113;
  if bad_old = 0 then raise exception '옛 기준 복사본이 격자에서 한 번도 어긋나지 않음 — 시험이 날짜 경계 오류를 못 잡음'; end if;
  raise notice 'deactivate_expired_vn_date local check passed (실제 함수 96시각 전부 베트남 날짜 기준 일치, 옛 기준은 UTC 17~24시 % 시각에서 어긋남)', bad_old;
end $check$;

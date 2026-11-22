-- 시험 DB 전용 확인: (A) 실제 함수가 지금 시각 기준 베트남 날짜로 만료 처리한다 (B) 시각 격자에서 옛 기준(UTC 날짜)과 새 기준(베트남 날짜)의 차이가
-- "UTC 17~24시 구간의 마감일 = 베트남 어제" 뿐이고, 새 기준이 옛 기준보다 덜 닫는 경우·화면이 열림으로 보는 공고를 닫는 경우는 없다.
do $check$
declare
  vn date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  got boolean[];
  n int;
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

  -- (B) 시각 격자: 옛 기준(DB 시간대 UTC 날짜) vs 새 기준(베트남 날짜)
  create temp table _dx on commit drop as
  select t, d,
         (d < (t at time zone 'UTC')::date) as old_closes,
         (d < (t at time zone 'Asia/Ho_Chi_Minh')::date) as new_closes,
         -- 화면 isJobOpen(src/lib/jobDetailView.ts: 마감일 >= 베트남 오늘이면 열림, 베트남 = +07:00 고정)을 시간대 이름이 아니라 +7시간 더하기로 따로 표현
         not (d >= ((t at time zone 'UTC') + interval '7 hours')::date) as screen_closed
  from generate_series(timestamptz '2026-11-20 00:00+00', timestamptz '2026-11-23 23:00+00', interval '1 hour') t,
       generate_series(date '2026-11-15', date '2026-11-27', interval '1 day') d(d);
  -- 새 기준이 옛 기준이 닫던 공고를 안 닫는 경우는 없다(덜 닫지 않는다)
  select count(*) into n from _dx where old_closes and not new_closes;
  if n > 0 then raise exception '새 기준이 옛 기준보다 덜 닫는 경우 %건', n; end if;
  -- 새 기준이 화면이 열림으로 보는 공고를 닫는 경우는 없다
  select count(*) into n from _dx where new_closes and not screen_closed;
  if n > 0 then raise exception '화면이 열림으로 보는 공고를 새 기준이 닫음 %건', n; end if;
  -- 옛·새 기준이 다른 경우는 UTC 17시~24시 구간의 "마감일 = 베트남 어제" 뿐이다
  select count(*) into n from _dx
   where old_closes is distinct from new_closes
     and not (extract(hour from t at time zone 'UTC') >= 17 and d = (t at time zone 'Asia/Ho_Chi_Minh')::date - 1);
  if n > 0 then raise exception '의도하지 않은 차이 %건', n; end if;
  -- 그 구간에서는 실제로 다르다(시험이 빈 껍데기가 아님)
  select count(*) into n from _dx where old_closes is distinct from new_closes;
  if n = 0 then raise exception '격자에서 차이가 하나도 없음 — 시험이 의미 없음'; end if;
  raise notice 'deactivate_expired_vn_date local check passed (격자 차이 %건, 전부 UTC 17~24시의 마감일=베트남 어제)', n;
end $check$;

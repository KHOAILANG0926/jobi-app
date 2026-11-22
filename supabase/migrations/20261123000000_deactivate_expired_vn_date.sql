-- 1-B(F2, Lee 2026-11-22 승인): 공고 만료 처리(deactivate_expired_jobs)의 "오늘"을 DB 시간대(UTC)가 아니라 베트남 날짜로 맞춘다.
-- 왜: 화면(isJobOpen)·알림 RPC·공개 판정은 마감일 다음 날부터 닫힌 것으로 본다(마감 당일은 열림, 베트남 날짜). 이 cron은 매일 17:00 UTC(= 베트남 00:00)에 도는데,
--     그때 now()::date 는 UTC 날짜라 베트남 날짜보다 하루 늦다 → 마감일이 막 지난 공고가 24시간 더 active=true 로 남는다(화면은 이미 숨김).
-- 바뀌는 것: 비교 기준 한 줄 `now()::date` → `(now() at time zone 'Asia/Ho_Chi_Minh')::date`. 함수 이름·시그니처·권한·cron 일정은 그대로.
--   17:00~24:00 UTC 구간에 실행될 때만 결과가 달라지고, 달라지는 대상은 "마감일 = 베트남 어제"인 공개 공고뿐이다(화면이 이미 닫힌 것으로 보는 공고).
--   마감 당일·미래·마감 없음 공고는 어느 시각에도 건드리지 않는다. 새 공고 등록·수정·위치·정책 판정은 바뀌지 않는다.
-- 되돌리기: 이 함수 본문을 이전(0011) 그대로 되돌리는 새 migration(`application_deadline < now()::date`). 데이터 변경 없음.
-- 시험: supabase/tests/deactivate_expired_vn_date.setup.sql / .local.sql(시각 격자 전후 비교) / _production_check.sql(읽기 전용).
begin;

create or replace function public.deactivate_expired_jobs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  affected integer;
begin
  update public.local_jobs
  set active = false
  where active = true
    and application_deadline is not null
    and application_deadline < (now() at time zone 'Asia/Ho_Chi_Minh')::date;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.deactivate_expired_jobs() from public, anon, authenticated;

commit;

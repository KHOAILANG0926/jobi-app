-- 근무조건 구조화(2차): hours/work_days 원본 텍스트는 그대로 두고,
-- shift_type/work_start_time/work_end_time만 신중하게 추가한다.
--
-- 실제 hours 44건 전수 검토 결과: 한 필드에 시간대가 2개 이상 섞여
-- 있거나(예: "8h-16h, 15h-23h"), 근무시간과 무관한 텍스트가 섞인 경우가
-- 흔해서, 요일(work_days) 구조화는 이번 단계에서 시도하지 않는다(불안정 —
-- 지시사항대로 "무리하게 새 구조를 만들지 않는다"에 해당). 시간대는 문자열
-- 안에서 시간 패턴이 "정확히 1개"만 발견될 때만 구조화하고, 2개 이상이거나
-- 0개면 NULL로 둔다(어느 시간이 진짜인지 추측하지 않음).

begin;

alter table public.local_jobs
  add column if not exists shift_type text,
  add column if not exists work_start_time time,
  add column if not exists work_end_time time;

alter table public.local_jobs
  add constraint local_jobs_shift_type_check
  check (shift_type is null or shift_type in ('day', 'night', 'rotating', 'other'));

create or replace function public.parse_work_hours_vi(input text)
returns table (
  shift text,
  start_time time,
  end_time time
)
language plpgsql
immutable
as $$
declare
  t text := coalesce(input, '');
  t_lower text := lower(t);
  range_pattern text := '(\d{1,2})\s*[h:g]\s*(\d{0,2})\s*(?:đến|-|–)\s*(\d{1,2})\s*[h:g]\s*(\d{0,2})';
  match_count integer;
  m text[];
  sh integer; sm integer; eh integer; em integer;
  start_t time;
  end_t time;
begin
  if trim(t) = '' then
    return query select null::text, null::time, null::time;
    return;
  end if;

  -- "교대/순환" 명시 표현 — 어느 시간대인지 특정 안 되므로 시간은 NULL.
  if t_lower like '%xoay ca%' or t_lower like '%ca xoay%' or t_lower like '%3 ca%' then
    return query select 'rotating'::text, null::time, null::time;
    return;
  end if;

  select count(*) into match_count from regexp_matches(t, range_pattern, 'g');

  if match_count = 1 then
    m := regexp_match(t, range_pattern);
    sh := m[1]::integer;
    sm := coalesce(nullif(m[2], ''), '0')::integer;
    eh := m[3]::integer;
    em := coalesce(nullif(m[4], ''), '0')::integer;
    if sh between 0 and 23 and eh between 0 and 23 and sm between 0 and 59 and em between 0 and 59 then
      start_t := make_time(sh, sm, 0);
      end_t := make_time(eh, em, 0);
      if end_t < start_t then
        -- 자정을 넘김(예: 15:00 – 01:00) — 야간으로 판정.
        return query select 'night'::text, start_t, end_t;
      elsif sh >= 18 or sh < 5 then
        return query select 'night'::text, start_t, end_t;
      elsif sh >= 5 and eh <= 21 then
        return query select 'day'::text, start_t, end_t;
      else
        return query select 'other'::text, start_t, end_t;
      end if;
      return;
    end if;
  end if;

  -- 시간 패턴이 없거나(0개) 여러 개(2개 이상)라 특정 못 하는 경우 —
  -- "사무직 근무시간(giờ hành chính)"처럼 시간대는 몰라도 주간인 것만은
  -- 명확한 경우만 예외적으로 day로 분류, 시간값은 넣지 않는다.
  if t_lower like '%giờ hành chính%' then
    return query select 'day'::text, null::time, null::time;
    return;
  end if;

  return query select null::text, null::time, null::time;
end;
$$;

update public.local_jobs j
set
  shift_type = p.shift,
  work_start_time = p.start_time,
  work_end_time = p.end_time
from (select id, (public.parse_work_hours_vi(hours)).* from public.local_jobs) p
where p.id = j.id;

commit;

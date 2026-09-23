-- 급여 구조화: 기존 salary(자유텍스트)는 절대 건드리지 않고, 검색/정렬용
-- 구조화 컬럼만 추가한다. 파싱 실패 시 구조화 값은 전부 NULL로 남긴다
-- (임의 숫자로 채우지 않음).

begin;

alter table public.local_jobs
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists salary_currency text,
  add column if not exists salary_period text,
  add column if not exists salary_negotiable boolean;

alter table public.local_jobs
  add constraint local_jobs_salary_period_check
  check (salary_period is null or salary_period in ('hour', 'day', 'month', 'other'));

alter table public.local_jobs
  add constraint local_jobs_salary_currency_check
  check (salary_currency is null or salary_currency in ('VND', 'USD'));

alter table public.local_jobs
  add constraint local_jobs_salary_min_max_check
  check (salary_min is null or salary_max is null or salary_min <= salary_max);

-- 베트남어 급여 표현 파서. 실제 273건 salary 값 전수 조사 결과 아래 3개
-- 패턴(구간 "X - Y triệu", 협의 표현, 달러 구간)으로 100% 커버됨을 확인—
-- 향후 크롤링에서 나올 수 있는 "Từ/Trên/Đến X triệu"(단측 구간)도 함께
-- 지원한다. 매칭 안 되는 문자열은 전부 NULL(추측 금지).
create or replace function public.parse_salary_vi(input text)
returns table (
  min_value integer,
  max_value integer,
  currency text,
  period text,
  negotiable boolean
)
language plpgsql
immutable
as $$
declare
  t text := trim(coalesce(input, ''));
  m text[];
begin
  if t = '' then
    return query select null::integer, null::integer, null::text, null::text, null::boolean;
    return;
  end if;

  -- 협의/협상 — 명시적 표현만 인정
  if t in ('Thỏa thuận', 'Thương lượng') then
    return query select null::integer, null::integer, null::text, null::text, true;
    return;
  end if;

  -- 달러 구간: "$ 800-1,000 /tháng"
  m := regexp_match(t, '^\$\s*([\d,]+)\s*-\s*([\d,]+)\s*/\s*tháng$');
  if m is not null then
    return query select
      replace(m[1], ',', '')::integer,
      replace(m[2], ',', '')::integer,
      'USD'::text, 'month'::text, false;
    return;
  end if;

  -- 구간: "9 - 15 triệu" (단위: 백만동/월)
  m := regexp_match(t, '^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*triệu$');
  if m is not null then
    return query select
      round(m[1]::numeric * 1000000)::integer,
      round(m[2]::numeric * 1000000)::integer,
      'VND'::text, 'month'::text, false;
    return;
  end if;

  -- 단측 구간: "Từ 12 triệu" / "Trên 10 triệu" (최소값만)
  m := regexp_match(t, '^(?:Từ|Trên)\s+(\d+(?:\.\d+)?)\s*triệu$');
  if m is not null then
    return query select
      round(m[1]::numeric * 1000000)::integer,
      null::integer, 'VND'::text, 'month'::text, false;
    return;
  end if;

  -- 단측 구간: "Đến 15 triệu" (최대값만)
  m := regexp_match(t, '^Đến\s+(\d+(?:\.\d+)?)\s*triệu$');
  if m is not null then
    return query select
      null::integer,
      round(m[1]::numeric * 1000000)::integer,
      'VND'::text, 'month'::text, false;
    return;
  end if;

  -- 매칭 실패 — 추측하지 않고 전부 NULL
  return query select null::integer, null::integer, null::text, null::text, null::boolean;
end;
$$;

-- 기존 273건 백필 — salary 원본은 그대로 두고 구조화 컬럼만 채운다.
update public.local_jobs j
set
  salary_min = p.min_value,
  salary_max = p.max_value,
  salary_currency = p.currency,
  salary_period = p.period,
  salary_negotiable = p.negotiable
from (select id, (public.parse_salary_vi(salary)).* from public.local_jobs) p
where p.id = j.id;

commit;

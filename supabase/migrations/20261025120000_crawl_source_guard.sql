-- 수집 소스 자동 멈춤 (Lee 결정 2026-10-25, 채팅 "ok")
-- 같은 수집 소스(muaban·chotot·facebook …)에서 같은 원인으로 공고 3건이 연달아 실패하면 그 소스만 멈춘다.
--   1) 그 소스만 멈춤: 멈춘 소스의 새 수집 공고(origin='crawler')는 DB가 저장을 거부한다 → 어느 수집기든 코드와 상관없이 멈춤.
--      다른 소스는 계속. 이미 들어온 공고는 지우지 않는다.
--   2) 알림: crawl_source_state.notified_at이 비면 GitHub 자동 작업(crawl-guard.yml)이 Lee에게 알린다(AI 없이).
--   3) 자동 수리: 같은 자동 작업이 Claude 수리 작업을 시작한다(멈춤 1번당 최대 2번, fix_attempts).
--   4) 자동 재개: 멈춤 원인이 된 공고(sample_job_ids)가 모두 다시 성공하면(고친 코드로 재처리) 자동으로 풀린다.
--   5) 2번 고쳐도 안 되면: 원인 종류별로 Lee에게 할 일을 알린다(로그인·칸 고르기·외부 고장 대기·결정).
--   6) 풀릴 때까지 매일 저녁 알림에 "멈춘 소스, N일째"로 표시.
-- 실패/성공은 수집기 코드가 아니라 DB에서 기록한다(트리거) — AI가 기록을 빼먹을 수 없게.
--   실패: 위치 못 찾음(map_r1_unlocated 추가), 포스터 글자 불일치(ocr_check.status='mismatch')
--   성공: 공고가 공개됨(active=true), 위치를 다시 찾음(map_r1_unlocated 삭제)

create table if not exists public.crawl_source_state (
  source text primary key,
  paused boolean not null default false,
  reason text,
  paused_at timestamptz,
  resumed_at timestamptz,
  sample_job_ids bigint[] not null default '{}',
  fix_attempts integer not null default 0,
  last_fix_at timestamptz,
  fix_merged_at timestamptz,
  retried_at timestamptz,
  notified_at timestamptz,
  escalated_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.crawl_job_outcomes (
  job_id bigint not null,
  stage text not null,
  source text not null,
  ok boolean not null,
  reason text,
  at timestamptz not null default now(),
  primary key (job_id, stage)
);
create index if not exists crawl_job_outcomes_source_at on public.crawl_job_outcomes (source, at desc);
alter table public.crawl_source_state enable row level security;
alter table public.crawl_job_outcomes enable row level security;
revoke all on public.crawl_source_state from public, anon, authenticated;
revoke all on public.crawl_job_outcomes from public, anon, authenticated;
grant select, insert, update, delete on public.crawl_source_state, public.crawl_job_outcomes to service_role;

-- 'manual:poster:2026…' → 'manual', 'chotot' → 'chotot'
create or replace function public.crawl_source_key(p_source text) returns text
language sql immutable set search_path = pg_catalog as $$
  select nullif(lower(split_part(coalesce(p_source, ''), ':', 1)), '')
$$;

-- 결과 기록 + 멈춤/재개 판정. 수집 공고(origin='crawler')만 센다.
create or replace function public.crawl_record_outcome(p_job_id bigint, p_stage text, p_ok boolean, p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare src text; latest record; reasons text[]; ids bigint[]; st public.crawl_source_state;
begin
  select public.crawl_source_key(j.source) into src from public.local_jobs j where j.id = p_job_id and j.origin = 'crawler';
  if src is null then return; end if;
  insert into public.crawl_job_outcomes(job_id, stage, source, ok, reason, at)
  values (p_job_id, p_stage, src, p_ok, case when p_ok then null else p_reason end, clock_timestamp())
  on conflict (job_id, stage) do update set ok = excluded.ok, reason = excluded.reason, source = excluded.source, at = clock_timestamp();

  -- 공고마다 마지막 결과 하나(실패가 하나라도 남아 있으면 실패). 최근 공고 3건.
  select array_agg(r.reason order by r.at desc), array_agg(r.job_id order by r.at desc) into reasons, ids
  from (
    select o.job_id, max(o.at) as at,
           (array_agg(o.reason order by o.at desc) filter (where not o.ok))[1] as reason
    from public.crawl_job_outcomes o
    where o.source = src
    group by o.job_id
    order by max(o.at) desc
    limit 3
  ) r;

  select * into st from public.crawl_source_state where source = src for update;
  if not found then
    insert into public.crawl_source_state(source) values (src) returning * into st;
  end if;

  if not st.paused then
    -- 멈춤: 최근 3건이 모두 실패이고 원인이 같다
    if coalesce(array_length(reasons, 1), 0) = 3 and reasons[1] is not null
       and reasons[1] = reasons[2] and reasons[2] = reasons[3] then
      update public.crawl_source_state
        set paused = true, reason = reasons[1], paused_at = now(), resumed_at = null, sample_job_ids = ids,
            fix_attempts = 0, last_fix_at = null, fix_merged_at = null, retried_at = null, notified_at = null, escalated_at = null, updated_at = now()
        where source = src;
    end if;
  else
    -- 재개: 멈춤 원인 공고가 모두 마지막 결과 성공(실패 기록 없음)
    if p_ok and not exists (
      select 1 from public.crawl_job_outcomes o
      where o.job_id = any(st.sample_job_ids) and not o.ok
    ) then
      update public.crawl_source_state
        set paused = false, resumed_at = now(), notified_at = null, updated_at = now()
        where source = src;
    end if;
  end if;
end $$;
revoke all on function public.crawl_record_outcome(bigint, text, boolean, text) from public, anon, authenticated;
grant execute on function public.crawl_record_outcome(bigint, text, boolean, text) to service_role;

create or replace function public.crawl_source_allowed(p_source text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select not exists (select 1 from public.crawl_source_state s where s.source = public.crawl_source_key(p_source) and s.paused)
$$;
grant execute on function public.crawl_source_allowed(text) to service_role;

-- 1) 멈춘 소스의 새 수집 공고 저장 거부
create or replace function public.crawl_guard_insert() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.origin = 'crawler' and not public.crawl_source_allowed(new.source) then
    raise exception 'crawl_source_paused: % 수집이 멈춘 상태(같은 원인 3건 연속 실패). 자동 수리·재개 후 다시 수집됩니다.', public.crawl_source_key(new.source)
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_crawl_guard_insert on public.local_jobs;
create trigger trg_crawl_guard_insert before insert on public.local_jobs
  for each row execute function public.crawl_guard_insert();

-- 결과 기록 트리거: 공개됨(성공) / 포스터 불일치(실패)
create or replace function public.crawl_outcome_from_job() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.origin is distinct from 'crawler' then return new; end if;
  if new.active and (tg_op = 'INSERT' or not coalesce(old.active, false)) then
    perform public.crawl_record_outcome(new.id, 'ocr', true, null);
    perform public.crawl_record_outcome(new.id, 'publish', true, null);
  end if;
  if new.ocr_check->>'status' = 'mismatch'
     and (tg_op = 'INSERT' or old.ocr_check->>'status' is distinct from 'mismatch') then
    perform public.crawl_record_outcome(new.id, 'ocr', false, 'ocr_mismatch');
  end if;
  return new;
end $$;
drop trigger if exists trg_crawl_outcome_from_job on public.local_jobs;
create trigger trg_crawl_outcome_from_job after insert or update of active, ocr_check on public.local_jobs
  for each row execute function public.crawl_outcome_from_job();

-- 결과 기록 트리거: 위치 못 찾음(실패) / 다시 찾음(성공)
create or replace function public.crawl_outcome_from_unlocated() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    perform public.crawl_record_outcome(old.job_id, 'location', true, null);
    return old;
  end if;
  perform public.crawl_record_outcome(new.job_id, 'location', false, 'location_not_found');
  return new;
end $$;
drop trigger if exists trg_crawl_outcome_from_unlocated on public.map_r1_unlocated;
create trigger trg_crawl_outcome_from_unlocated after insert or delete on public.map_r1_unlocated
  for each row execute function public.crawl_outcome_from_unlocated();

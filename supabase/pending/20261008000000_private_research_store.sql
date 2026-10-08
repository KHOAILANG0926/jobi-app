-- 2026-10-08 [미적용 · 사용자 승인 대기] 수집·검토 데이터/백업 비공개 저장소 + VietMap 일일 호출 카운터.
--
-- 목적(사용자 지시 2026-10-08): PC(회사 PC는 사용자 소유 아님)에 CSV·JSON·백업 파일을 저장하지 않는다.
--   수집·검토 데이터와 백업은 Supabase 비공개 테이블(RLS로 공개 접근 차단)에 둔다.
--   VietMap Search/Place 호출 횟수(하루 250회 상한)는 서버(Vercel 함수) 한 곳에서 이 카운터로 센다.
--
-- 설계 원칙
-- - 순수 additive: 기존 테이블·컬럼·RLS·함수는 변경하지 않는다.
-- - 두 테이블 모두 RLS 켬 + 정책 없음 + anon/authenticated 권한 전부 회수 → 직접 접근 불가.
--   (local_jobs_description_backup 과 같은 방식)
-- - 접근은 아래 함수로만: 관리자 로그인 세션(app_metadata.role='admin')은 research_* RPC,
--   서버(service_role, Vercel 환경변수 키)는 vietmap_usage_take.
-- - 승인 전에는 아무것도 적용하지 않는다. 적용 후 이 파일을 supabase/migrations/ 로 옮기고(버전 = 적용 시각) 기록한다.

begin;

create table if not exists public.research_artifacts (
  id bigint generated always as identity primary key,
  kind text not null check (length(trim(kind)) > 0),          -- 예: chotot_candidates, vietmap_cache, backup_local_jobs
  name text not null check (length(trim(name)) > 0),          -- 예: 20261008T010203Z, chotot_jobs
  payload jsonb not null,                                      -- CSV/JSON/백업 행 전체(JSON으로)
  meta jsonb not null default '{}'::jsonb,                     -- 건수·sha256·사유 등(민감값 금지)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (kind, name)
);
alter table public.research_artifacts enable row level security;
revoke all on public.research_artifacts from anon, authenticated;

create table if not exists public.vietmap_usage_daily (
  day date primary key,                                        -- 베트남 날짜(UTC+7)
  calls integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now()
);
alter table public.vietmap_usage_daily enable row level security;
revoke all on public.vietmap_usage_daily from anon, authenticated;

-- 관리자 세션으로만: 저장(같은 kind+name이면 덮어씀)
create or replace function public.admin_save_research_artifact(
  p_kind text, p_name text, p_payload jsonb, p_meta jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); result bigint;
begin
  insert into public.research_artifacts(kind, name, payload, meta, created_by)
  values (p_kind, p_name, p_payload, coalesce(p_meta, '{}'::jsonb), caller)
  on conflict (kind, name) do update
    set payload = excluded.payload, meta = excluded.meta, created_by = excluded.created_by, created_at = now()
  returning id into result;
  return result;
end;
$$;

-- 관리자 세션으로만: 읽기(없으면 null)
create or replace function public.admin_get_research_artifact(p_kind text, p_name text)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare result jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object('payload', a.payload, 'meta', a.meta, 'created_at', a.created_at)
    into result from public.research_artifacts a where a.kind = p_kind and a.name = p_name;
  return result;
end;
$$;

-- 관리자 세션으로만: 목록(payload 제외)
create or replace function public.admin_list_research_artifacts(p_kind text default null)
returns table (kind text, name text, meta jsonb, created_at timestamptz)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  return query
    select a.kind, a.name, a.meta, a.created_at from public.research_artifacts a
    where p_kind is null or a.kind = p_kind order by a.created_at desc limit 500;
end;
$$;

-- 서버(service_role)만: 오늘 호출 1회를 원자적으로 예약. 상한을 넘으면 증가시키지 않고 ok=false.
create or replace function public.vietmap_usage_take(p_day date, p_limit integer)
returns table (ok boolean, used integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.vietmap_usage_daily(day, calls) values (p_day, 0) on conflict (day) do nothing;
  update public.vietmap_usage_daily u
     set calls = u.calls + 1, updated_at = now()
   where u.day = p_day and u.calls < p_limit
   returning true, u.calls into ok, used;
  if ok is null then
    select false, u.calls into ok, used from public.vietmap_usage_daily u where u.day = p_day;
  end if;
  return next;
end;
$$;

revoke all on function public.admin_save_research_artifact(text, text, jsonb, jsonb) from public, anon;
revoke all on function public.admin_get_research_artifact(text, text) from public, anon;
revoke all on function public.admin_list_research_artifacts(text) from public, anon;
revoke all on function public.vietmap_usage_take(date, integer) from public, anon, authenticated;
grant execute on function public.admin_save_research_artifact(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.admin_get_research_artifact(text, text) to authenticated;
grant execute on function public.admin_list_research_artifacts(text) to authenticated;
grant execute on function public.vietmap_usage_take(date, integer) to service_role;

commit;

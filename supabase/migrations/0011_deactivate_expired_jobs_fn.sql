-- 재사용 가능한 함수만 추가한다 — 어떤 스케줄러/cron/트리거에도 아직 연결하지
-- 않는다. 실행은 나중에 별도로 명시적으로 호출(또는 스케줄 연결)할 때만 일어난다.
-- application_deadline이 지났는데 active=true로 남아있는 기존 77건은 이 migration과
-- 무관하게 이미 수동으로 한 번 정리했다(별도 UPDATE, 여기 포함 안 됨).

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
    and application_deadline < now()::date;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- service_role만 실행 — 이 함수는 아직 아무 스케줄러에도 연결되지 않았고,
-- 연결되기 전까지는 사람이 SQL Editor/CLI에서 직접 호출하는 용도로만 쓴다.
revoke all on function public.deactivate_expired_jobs() from public, anon, authenticated;

commit;

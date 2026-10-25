-- 공고 저장 순간 "검사해" 신호 (Lee 2026-10-25: "처음부터 정 방향으로" — 30분마다 확인이 아니라 바뀌는 순간에)
-- 왜: GitHub 예약 실행은 실제로 몇 시간에 한 번만 돌았다(2026-10-25 실측: 06:39 → 11:21). 검사표가 늦게 오고 수집 멈춤 감시는 한 번도 안 돎.
-- 어떻게:
--   1) 공고의 "입력"(제목·원문·이미지·근무지·회사·공개 여부 등)이 바뀌거나 위치 결과·수집 멈춤 상태가 바뀌면 → 신호 대기표에 "요청" 기록(트리거)
--      검사 작업이 쓰는 "결과" 칸(상세요강·급여·ocr_check·복리후생)이 바뀐 것은 신호를 안 보낸다(자기 자신을 계속 부르지 않게).
--   2) DB 시계(pg_cron)가 1분마다 대기표를 보고, 요청이 30초 이상 조용히 쌓였으면(여러 건 저장을 한 번에) GitHub 작업을 바로 시작시킨다.
--      job-ocr-check.yml = 포스터 대조 → AI 칸·복리후생 → 상세요강 → 검사표 / crawl-guard.yml = 수집 멈춤 알림·수리·재개
--   3) 안전망: 하루 한 번(베트남 05:10)은 요청이 없어도 두 작업을 돌린다.
-- 열쇠: Supabase 금고(Vault)의 github_dispatch_token (jobi-app 저장소, Actions 시작 권한만). DB는 이 열쇠로 코드를 바꿀 수 없다.
-- 함께: local_jobs.updated_at(마지막으로 고친 시각) 추가 — 기존 공고는 비워 둠(일괄 수정하면 다른 규칙 트리거가 돌아서).

alter table public.local_jobs add column if not exists updated_at timestamptz;
create or replace function public.local_jobs_touch_updated_at() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_local_jobs_touch_updated_at on public.local_jobs;
create trigger trg_local_jobs_touch_updated_at before update on public.local_jobs
  for each row execute function public.local_jobs_touch_updated_at();

create table if not exists public.job_signal_queue (
  workflow text primary key,
  requested_at timestamptz,
  sent_at timestamptz,
  last_status integer,
  last_request_id bigint
);
alter table public.job_signal_queue enable row level security;
revoke all on public.job_signal_queue from public, anon, authenticated;
grant select, insert, update on public.job_signal_queue to service_role;
insert into public.job_signal_queue(workflow) values ('job-ocr-check.yml'), ('crawl-guard.yml') on conflict do nothing;

create or replace function public.job_signal_request(p_workflow text) returns void
language sql security definer set search_path = pg_catalog, public as $$
  insert into public.job_signal_queue(workflow, requested_at) values (p_workflow, now())
  on conflict (workflow) do update set requested_at = now()
$$;
revoke all on function public.job_signal_request(text) from public, anon, authenticated;

-- 공고 입력이 바뀜 → 검사 요청
create or replace function public.job_signal_from_job() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT'
     or new.title is distinct from old.title or new.company is distinct from old.company
     or new.source_text is distinct from old.source_text or new.images is distinct from old.images
     or new.location is distinct from old.location or new.active is distinct from old.active
     or new.admin_hidden is distinct from old.admin_hidden or new.occupation_code is distinct from old.occupation_code
     or new.category is distinct from old.category then
    perform public.job_signal_request('job-ocr-check.yml');
  end if;
  return null;
end $$;
drop trigger if exists trg_job_signal_from_job on public.local_jobs;
create trigger trg_job_signal_from_job after insert or update on public.local_jobs
  for each row execute function public.job_signal_from_job();

-- 근무지·위치 결과가 바뀜 → 검사 요청
create or replace function public.job_signal_from_location() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin perform public.job_signal_request('job-ocr-check.yml'); return null; end $$;
drop trigger if exists trg_job_signal_from_work_locations on public.job_work_locations;
create trigger trg_job_signal_from_work_locations after insert or update or delete on public.job_work_locations
  for each statement execute function public.job_signal_from_location();
drop trigger if exists trg_job_signal_from_map_r1 on public.map_r1_location_jobs;
create trigger trg_job_signal_from_map_r1 after insert or update of result on public.map_r1_location_jobs
  for each statement execute function public.job_signal_from_location();
drop trigger if exists trg_job_signal_from_unlocated on public.map_r1_unlocated;
create trigger trg_job_signal_from_unlocated after insert or delete on public.map_r1_unlocated
  for each statement execute function public.job_signal_from_location();

-- 수집 멈춤/재개 → 감시 작업 요청
create or replace function public.job_signal_from_crawl_state() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' or new.paused is distinct from old.paused then
    perform public.job_signal_request('crawl-guard.yml');
  end if;
  return null;
end $$;
drop trigger if exists trg_job_signal_from_crawl_state on public.crawl_source_state;
create trigger trg_job_signal_from_crawl_state after insert or update on public.crawl_source_state
  for each row execute function public.job_signal_from_crawl_state();

-- 신호 보내기: 요청이 30초 이상 조용하면 GitHub 작업 시작(같은 요청은 한 번만)
create or replace function public.job_signal_send(p_force boolean default false) returns integer
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare t text; q record; n integer := 0; rid bigint;
begin
  select decrypted_secret into t from vault.decrypted_secrets where name = 'github_dispatch_token' limit 1;
  if t is null then return 0; end if;
  for q in select * from public.job_signal_queue
           where p_force or (requested_at is not null and requested_at < now() - interval '30 seconds'
                             and (sent_at is null or requested_at > sent_at))
           for update skip locked loop
    select net.http_post(
      url := 'https://api.github.com/repos/KHOAILANG0926/jobi-app/actions/workflows/' || q.workflow || '/dispatches',
      body := jsonb_build_object('ref', 'master'),
      headers := jsonb_build_object('Authorization', 'Bearer ' || t, 'Accept', 'application/vnd.github+json',
                                    'X-GitHub-Api-Version', '2022-11-28', 'User-Agent', 'viecganban-db-signal',
                                    'Content-Type', 'application/json'),
      timeout_milliseconds := 20000) into rid;
    update public.job_signal_queue set sent_at = now(), last_request_id = rid where workflow = q.workflow;
    n := n + 1;
  end loop;
  return n;
exception when others then
  return n; -- 신호 실패가 DB 작업을 막지 않는다(다음 분에 다시)
end $$;
revoke all on function public.job_signal_send(boolean) from public, anon, authenticated;

-- 보낸 신호의 GitHub 응답 기록(204 = 시작됨). 1분 뒤 확인.
create or replace function public.job_signal_record_status() returns void
language sql security definer set search_path = pg_catalog, public, extensions as $$
  update public.job_signal_queue q set last_status = r.status_code
  from net._http_response r where r.id = q.last_request_id and q.last_status is distinct from r.status_code
$$;

select cron.unschedule(jobid) from cron.job where jobname in ('job-signal-send', 'job-signal-daily');
select cron.schedule('job-signal-send', '* * * * *', 'select public.job_signal_record_status(); select public.job_signal_send(false);');
select cron.schedule('job-signal-daily', '10 22 * * *', 'select public.job_signal_send(true);'); -- 베트남 05:10 안전망

-- 적용 직후 한 번 신호(연결 확인용)
select public.job_signal_request('job-ocr-check.yml');

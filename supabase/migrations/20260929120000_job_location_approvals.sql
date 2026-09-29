-- 2026-09-29 근무지 좌표 후보 보관 + 관리자(사람) 승인.
--
-- 배경: 2026-09-29 "잘못된 위치 안내 차단"(commit 0b486e0) 이후 정확한 핀·길찾기·거리 검색은
-- 확인된 근무지만 쓰는데, 확인 수단이 job_work_locations.location_verified(원본 사이트가 준
-- 좌표와의 대조) 하나뿐이라 활성 공고 중 확인 좌표가 0건이 됐다. 사람이 회사 공식 정보·원문을
-- 대조해 근무지를 승인하는 경로를 별도로 둔다.
--
-- 설계 원칙
-- - location_verified의 의미(원본 사이트 좌표 검증)는 바꾸지 않는다. 사람의 승인은 이 테이블에만.
-- - 크롤러 재수집(replace_job_work_locations: 근무지 행 전부 삭제 후 재삽입)과 분리된 테이블이라
--   재수집으로 승인이 사라지지 않는다(work_location_id는 참고용, 행이 지워지면 null).
-- - 승인 당시 회사명·근무지 텍스트를 스냅샷으로 남기고, 화면은 현재 공고와 스냅샷이 다르면 승인을
--   쓰지 않는다(= 회사나 주소가 바뀌면 재검토 필요).
-- - 공단·지역 중심점은 회사 위치로 승인할 수 없다: place_precision='area' 후보는 승인 불가(CHECK).
-- - 공고 등록·공개 여부와 무관(이 테이블은 위치 공개 수준만 결정).
-- 순수 additive — 기존 테이블·컬럼·RLS는 변경하지 않는다.

begin;

create table if not exists public.job_location_candidates (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.local_jobs(id) on delete cascade,
  work_location_id bigint references public.job_work_locations(id) on delete set null,
  -- 승인·검토 당시의 공고 회사명 / 원문 근무지 텍스트(변경 감지용 스냅샷)
  company_snapshot text not null check (length(trim(company_snapshot)) > 0),
  address_snapshot text not null check (length(trim(address_snapshot)) > 0),
  lat double precision not null check (lat between 8 and 24),
  lng double precision not null check (lng between 102 and 110),
  -- entrance=출입구 확인, building=건물/사업장 핀, site=사업장 부지, area=공단·지역(승인 불가)
  place_precision text not null check (place_precision in ('entrance', 'building', 'site', 'area')),
  -- 좌표의 출처
  source text not null check (source in ('company_official', 'map_listing', 'original_post', 'site_visit', 'other')),
  evidence text not null check (length(trim(evidence)) > 0),
  evidence_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint job_location_candidates_area_not_approvable
    check (status <> 'approved' or place_precision in ('entrance', 'building', 'site'))
);

create index if not exists job_location_candidates_job_idx on public.job_location_candidates(job_id);
-- 같은 공고·같은 근무지 텍스트에는 승인된 위치가 하나만
create unique index if not exists job_location_candidates_one_approved
  on public.job_location_candidates(job_id, address_snapshot) where status = 'approved';

alter table public.job_location_candidates enable row level security;

-- 공개 읽기: 승인된 위치만, 공개 중인 공고(active·비숨김)만, 지도 표시에 필요한 컬럼만
-- (근거·검토자는 관리자 RPC로만). 비공개 공고의 승인 좌표는 공개 조회에 나오지 않는다.
drop policy if exists job_location_candidates_public_approved on public.job_location_candidates;
create policy job_location_candidates_public_approved on public.job_location_candidates
  for select to anon, authenticated using (
    status = 'approved'
    and exists (select 1 from public.local_jobs j
                where j.id = job_location_candidates.job_id and j.active and not j.admin_hidden)
  );
revoke all on public.job_location_candidates from anon, authenticated;
grant select (job_id, company_snapshot, address_snapshot, lat, lng, place_precision, status)
  on public.job_location_candidates to anon, authenticated;
-- 쓰기는 아래 관리자 RPC로만(직접 insert/update/delete 권한 없음)

create or replace function public.admin_add_location_candidate(
  p_job_id bigint,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_precision text,
  p_source text,
  p_evidence text,
  p_evidence_urls text[] default '{}',
  p_work_location_id bigint default null
)
returns public.job_location_candidates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); company text; result public.job_location_candidates;
begin
  select j.company into company from public.local_jobs j where j.id = p_job_id;
  if company is null then raise exception 'job not found'; end if;
  insert into public.job_location_candidates(job_id, work_location_id, company_snapshot, address_snapshot,
    lat, lng, place_precision, source, evidence, evidence_urls, created_by)
  values (p_job_id, p_work_location_id, company, p_address, p_lat, p_lng, p_precision, p_source,
    p_evidence, coalesce(p_evidence_urls, '{}'), caller)
  returning * into result;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, 'location_candidate.add', 'job', p_job_id::text,
    jsonb_build_object('candidate_id', result.id, 'place_precision', p_precision, 'source', p_source));
  return result;
end;
$$;

-- action: approve(pending/revoked→approved) · reject(pending→rejected) · revoke(approved→revoked)
create or replace function public.admin_review_location_candidate(
  p_candidate_id bigint,
  p_action text,
  p_note text default ''
)
returns public.job_location_candidates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare caller uuid := public.require_admin(); cur public.job_location_candidates; result public.job_location_candidates;
  current_company text;
begin
  select * into cur from public.job_location_candidates where id = p_candidate_id for update;
  if cur.id is null then raise exception 'candidate not found'; end if;

  if p_action = 'approve' then
    if cur.status not in ('pending', 'revoked') then raise exception 'only pending/revoked candidates can be approved'; end if;
    if cur.place_precision = 'area' then raise exception 'area-level (industrial park/region center) cannot be approved as a workplace'; end if;
    select j.company into current_company from public.local_jobs j where j.id = cur.job_id;
    -- 승인 시점의 회사명으로 스냅샷을 갱신한다(검토자가 현재 공고를 보고 승인했다는 기록)
    update public.job_location_candidates set status = 'revoked', reviewed_by = caller, reviewed_at = now(),
      review_note = 'superseded by candidate ' || p_candidate_id
      where job_id = cur.job_id and address_snapshot = cur.address_snapshot and status = 'approved' and id <> cur.id;
    update public.job_location_candidates set status = 'approved', reviewed_by = caller, reviewed_at = now(),
      review_note = nullif(p_note, ''), company_snapshot = coalesce(current_company, company_snapshot)
      where id = cur.id returning * into result;
  elsif p_action = 'reject' then
    if cur.status <> 'pending' then raise exception 'only pending candidates can be rejected'; end if;
    update public.job_location_candidates set status = 'rejected', reviewed_by = caller, reviewed_at = now(),
      review_note = nullif(p_note, '') where id = cur.id returning * into result;
  elsif p_action = 'revoke' then
    if cur.status <> 'approved' then raise exception 'only approved candidates can be revoked'; end if;
    update public.job_location_candidates set status = 'revoked', reviewed_by = caller, reviewed_at = now(),
      review_note = nullif(p_note, '') where id = cur.id returning * into result;
  else
    raise exception 'unknown action %', p_action;
  end if;

  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, 'location_candidate.' || p_action, 'job', cur.job_id::text,
    jsonb_build_object('candidate_id', cur.id, 'note', coalesce(p_note, '')));
  return result;
end;
$$;

-- 관리자 검토 화면용: 후보 + 현재 공고 정보(변경 여부 판단용)
create or replace function public.admin_list_location_candidates()
returns table (
  id bigint, job_id bigint, job_title text, job_active boolean, current_company text, current_location text,
  company_snapshot text, address_snapshot text, lat double precision, lng double precision,
  place_precision text, source text, evidence text, evidence_urls text[], status text, review_note text,
  reviewed_at timestamptz, created_at timestamptz, address_still_present boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  return query
  select c.id, c.job_id, j.title, (j.active and not j.admin_hidden), j.company, j.location,
    c.company_snapshot, c.address_snapshot, c.lat, c.lng, c.place_precision, c.source, c.evidence, c.evidence_urls,
    c.status, c.review_note, c.reviewed_at, c.created_at,
    exists (select 1 from public.job_work_locations w where w.job_id = c.job_id and w.raw_address = c.address_snapshot)
      or j.location = c.address_snapshot
  from public.job_location_candidates c join public.local_jobs j on j.id = c.job_id
  order by (c.status = 'pending') desc, c.created_at desc;
end;
$$;

revoke all on function public.admin_add_location_candidate(bigint, text, double precision, double precision, text, text, text, text[], bigint) from public;
revoke all on function public.admin_review_location_candidate(bigint, text, text) from public;
revoke all on function public.admin_list_location_candidates() from public;
-- Supabase는 public 스키마의 새 함수에 anon 실행 권한을 기본 부여하므로 명시적으로 회수한다
revoke all on function public.admin_add_location_candidate(bigint, text, double precision, double precision, text, text, text, text[], bigint) from anon;
revoke all on function public.admin_review_location_candidate(bigint, text, text) from anon;
revoke all on function public.admin_list_location_candidates() from anon;
grant execute on function public.admin_add_location_candidate(bigint, text, double precision, double precision, text, text, text, text[], bigint) to authenticated;
grant execute on function public.admin_review_location_candidate(bigint, text, text) to authenticated;
grant execute on function public.admin_list_location_candidates() to authenticated;

commit;

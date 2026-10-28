-- Lee 2026-10-28 공통 규칙: canonical 위치(job_work_locations)에 원문 행정구역 대략 핀(area) 이상이 있으면
-- "위치 못 찾음" 자동 보류(map_r1_unlocated, active=false)를 걸지 않고, 이미 걸린 보류는 해제한다(prev_active 복구).
-- admin_hidden·직업분류·연락처 등 다른 공개 차단은 그대로(map_r1_mark_located가 admin_hidden 검사·트리거 거부 시 비공개 유지).
-- 모든 공고 대상, 개별 공고 특례 없음. 판정 근거는 canonical 점만 사용한다(후보·캐시 좌표 X).
begin;
do $$ begin
 if to_regclass('public.map_r1_unlocated') is null or to_regclass('public.job_work_locations') is null then
  raise exception 'area pin hold preflight: map_r1_unlocated/job_work_locations missing';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='job_work_locations' and column_name='point_kind') then
  raise exception 'area pin hold preflight: canonical point_kind missing';
 end if;
end $$;

create or replace function public.map_r1_has_canonical_pin(p_id bigint) returns boolean
language sql stable security invoker set search_path = pg_catalog, public as $$
 select exists(select 1 from public.job_work_locations w where w.job_id=p_id
  and w.point_kind in ('exact','gate','area') and w.lat is not null and w.lng is not null)
$$;
revoke all on function public.map_r1_has_canonical_pin(bigint) from public, anon, authenticated;
grant execute on function public.map_r1_has_canonical_pin(bigint) to service_role;

-- 기존 정의와 동일(20261020070000). 이 파일만으로 해제 경로가 완결되도록 다시 둔다.
create or replace function public.map_r1_mark_located(p_id bigint) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.map_r1_unlocated;
begin
  delete from public.map_r1_unlocated where job_id = p_id returning * into r;
  if not found or not r.prev_active then return; end if;
  begin
    update public.local_jobs set active = true where id = p_id and not admin_hidden;
  exception when others then
    return; -- 다른 공개 조건(직업분류 등)에 걸리면 비공개 그대로
  end;
end $$;
revoke all on function public.map_r1_mark_located(bigint) from public, anon, authenticated;
grant execute on function public.map_r1_mark_located(bigint) to service_role;

create or replace function public.map_r1_mark_unlocated(p_id bigint, p_reason text) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare was boolean;
begin
  -- canonical 핀(area 이상)이 있으면 "못 찾음"이 아니다: 보류하지 않고 기존 보류도 푼다.
  if public.map_r1_has_canonical_pin(p_id) then perform public.map_r1_mark_located(p_id); return; end if;
  select active into was from public.local_jobs where id = p_id for update;
  if not found then return; end if;
  insert into public.map_r1_unlocated(job_id, prev_active, reason) values (p_id, coalesce(was, false), coalesce(p_reason, 'our_miss'))
  on conflict (job_id) do update set last_checked = now(), reason = excluded.reason,
    prev_active = public.map_r1_unlocated.prev_active or excluded.prev_active;
  if was then update public.local_jobs set active = false where id = p_id; end if;
end $$;
revoke all on function public.map_r1_mark_unlocated(bigint, text) from public, anon, authenticated;
grant execute on function public.map_r1_mark_unlocated(bigint, text) to service_role;

-- 못 찾은 동안은 공개 금지. 단 canonical 핀이 생긴 공고는 "못 찾음" 목록에서 빼고 공개 요청을 그대로 둔다.
create or replace function public.map_r1_block_unlocated_publish() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.active and not coalesce(old.active, false) and exists(select 1 from public.map_r1_unlocated u where u.job_id = new.id) then
    if public.map_r1_has_canonical_pin(new.id) then
      delete from public.map_r1_unlocated where job_id = new.id;
    else
      update public.map_r1_unlocated set prev_active = true where job_id = new.id;
      new.active := false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_map_r1_block_unlocated on public.local_jobs;
create trigger trg_map_r1_block_unlocated before update of active on public.local_jobs
  for each row execute function public.map_r1_block_unlocated_publish();

-- 이미 걸린 보류 해제: canonical 핀이 있는 모든 보류 공고(공고 번호 고정 없음).
do $$ declare r record; n integer := 0; begin
 for r in select u.job_id from public.map_r1_unlocated u where public.map_r1_has_canonical_pin(u.job_id) order by u.job_id loop
  perform public.map_r1_mark_located(r.job_id); n := n + 1;
 end loop;
 raise notice 'area pin hold release: % job(s)', n;
end $$;
commit;

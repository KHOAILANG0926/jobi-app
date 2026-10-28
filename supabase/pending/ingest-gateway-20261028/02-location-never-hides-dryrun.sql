-- DRY-RUN ONLY (Lee 승인 전 적용 금지). Lee 2026-10-28 ①: 위치 결과는 핀·정확도 표시만 바꾸고 공개 여부는 바꾸지 않는다.
-- 관리자 확인은 선택(목록에는 남김). 트랜잭션 제어 없음: run-local.sh가 begin … rollback 안에서 읽는다.
-- 1) 앞으로: "위치 못 찾음"은 목록(map_r1_unlocated)에만 기록하고 active를 바꾸지 않는다.
create or replace function public.map_r1_mark_unlocated(p_id bigint, p_reason text) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if public.map_r1_has_canonical_pin(p_id) then perform public.map_r1_mark_located(p_id); return; end if;
  insert into public.map_r1_unlocated(job_id, prev_active, reason)
  select p_id, coalesce(j.active, false), coalesce(p_reason, 'our_miss') from public.local_jobs j where j.id = p_id
  on conflict (job_id) do update set last_checked = now(), reason = excluded.reason;
end $$;
-- 2) 앞으로: 목록에 있어도 공개를 막지 않는다(관리자 확인은 선택).
drop trigger if exists trg_map_r1_block_unlocated on public.local_jobs;
-- 3) 이미 위치 때문에만 숨겨진 공고(원래 공개였던 것)는 다시 공개 요청. 다른 차단(admin_hidden·직업분류·정책 등)은 트리거가 그대로 막는다.
do $$ declare r record; n int := 0; kept int := 0; begin
  for r in select u.job_id from public.map_r1_unlocated u join public.local_jobs j on j.id = u.job_id
           where u.prev_active and not j.active and not j.admin_hidden order by u.job_id loop
    begin
      update public.local_jobs set active = true where id = r.job_id;
      if (select active from public.local_jobs where id = r.job_id) then n := n + 1; else kept := kept + 1; end if;
    exception when others then kept := kept + 1; end;
  end loop;
  raise notice 'location-never-hides: republished %, kept hidden by other gates %', n, kept;
end $$;

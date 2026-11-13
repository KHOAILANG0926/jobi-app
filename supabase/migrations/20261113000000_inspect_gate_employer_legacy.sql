-- #728 R2 A4(Lee 2026-11-13 변경 방향 승인, STRICT: 정식 migration 경로로만 적용): 고용주·legacy 공고도 공개 "시작" 전에 검사 통과 기록을 요구한다.
-- 지금: enforce_job_inspect_current()는 origin이 crawler·admin일 때만 공개 시작을 검사 기록과 대조한다(20261101110000·20261101170000).
--       employer(고용주 직접 등록)·legacy는 `return new`로 곧바로 통과 — DB가 강제하는 공개 전 검증은 R8 직업분류·publish_gate(연락처·위치)·R4 정책뿐이다.
-- 변경(함수 한 곳, 한 줄): 대상 origin에 'employer','legacy'를 더한다. 나머지(공개 중인 공고는 내용이 바뀌어도 유지, 직접 내리면 hold 제거,
--       지금 내용의 통과 기록(content_hash + publishable)이 있어야 공개 시작)는 crawler·admin과 똑같이 그대로 적용된다. 위치·공고 내용·기존 공개 상태 변경 없음.
-- 짝 변경(DB 밖): scripts/ops/job-inspect.mjs의 검사 대상(SCOPE)에 inspect_hold가 걸린 employer·legacy 공고를 더해, 통과하면 검사기가 공개한다
--       (publishDecision은 hold가 있는 공고만 공개하므로 고용주가 직접 내린 공고를 검사기가 다시 올리지 않는다).
-- 영향: 고용주가 새로 올리거나 비공개에서 다시 공개하는 공고는 다음 검사 실행(job-ocr-check) 전까지 비공개(inspect_hold)로 대기한다 — 사용자에게 보이는 동작 변경이라 승인 필요.
create or replace function public.enforce_job_inspect_current() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  h text;
begin
  if coalesce(new.origin, '') not in ('crawler', 'admin', 'employer', 'legacy') then return new; end if;

  if not coalesce(new.active, false) then
    -- 누군가 공개 중인 공고를 직접 내리면 검사기가 되살리지 않는다.
    if tg_op = 'UPDATE' and coalesce(old.active, false) then
      new.ocr_check := coalesce(new.ocr_check, '{}'::jsonb) - 'inspect_hold';
    end if;
    return new;
  end if;

  -- 공개 중인 공고: 내용이 바뀌어도 내리지 않는다(재검사 실패 시 검사기가 내림).
  if tg_op = 'UPDATE' and coalesce(old.active, false) then return new; end if;

  -- 공개 시작: 지금 내용으로 검사 통과한 기록이 있어야 한다.
  h := public.job_inspect_content_hash(new);
  if new.ocr_check -> 'inspect' ->> 'content_hash' = h
     and coalesce((new.ocr_check -> 'inspect' ->> 'publishable')::boolean, false) then
    return new;
  end if;

  new.active := false;
  new.ocr_check := coalesce(new.ocr_check, '{}'::jsonb) || jsonb_build_object('inspect_hold', true);
  return new;
end $$;
revoke all on function public.enforce_job_inspect_current() from public, anon, authenticated;

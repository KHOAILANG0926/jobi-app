-- 이미 공개 중인 공고는 다시 정리되는 동안에도 공개 유지 (Lee 2026-11-01 "ok")
-- 문제: 20261101110000은 공개 중인 공고도 내용이 바뀌면 재검사 전까지 내렸다 → 규칙을 바꿔 전체 공고를
--       다시 정리하면 재검사가 끝날 때까지 사이트에서 공고가 사라짐(13:30 메인 지도 핀 2개).
-- 변경: 공개 "시작"(새 공고·비공개 → 공개)만 지금 내용으로 검사 통과한 기록이 있어야 허용한다.
--       공개 중인 공고는 내용이 바뀌어도 그대로 두고, 검사기(job-inspect)가 재검사에서 실패할 때만 내린다.
-- 다른 공개 규정(R4·R7·R8 등)은 각자 트리거가 그대로 강제한다. 위치 데이터 변경 없음.

create or replace function public.enforce_job_inspect_current() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  h text;
begin
  if coalesce(new.origin, '') not in ('crawler', 'admin') then return new; end if;

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

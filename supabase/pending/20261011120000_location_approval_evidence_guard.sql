-- PENDING (미적용) — 2026-10-11 사용자 승인 전 초안. 적용은 사용자 승인 후에만.
--
-- 목적: 근거 없는 좌표 승인을 DB가 거부한다.
--   2026-10-10~11 GPT가 하지 않은 검색을 "확인했다"고 보고한 사고 이후, AI의 말이 아니라
--   저장된 검색 근거가 있어야만 공개 핀이 생기게 한다. 서비스 키로 직접 UPDATE해도(관리자 RPC를
--   거치지 않아도) 트리거는 실행되므로 같은 기준이 적용된다.
--
-- 승인(approved로 바뀌는 순간)에만 검사한다. 이미 승인된 행·철회·거절에는 영향이 없다.
--   A. 자동 승인(evidence가 "[Tự động"으로 시작):
--      A1. 주소 검색 근거: "Tìm theo địa chỉ chi tiết trên VietMap" + "VietMap ref: geocode:"(공급자 응답 ID)
--          + "Địa chỉ VietMap:" 줄에 번지(숫자) — 승인 규칙 B안 ①
--      A2. KCN 근거: 공고 근무지에 industrial_park가 있고 evidence에 VietMap 응답 기록 — B안 ②
--   B. 수동 승인(그 외): evidence_urls에 근거 링크가 1개 이상 있어야 한다.
--
-- dry-run(2026-10-11, 읽기 전용 SELECT로 같은 조건을 기존 기록에 적용):
--   #4713(38)·#4721(40)·#4750(39) PASS / #4702(37)·#4720(18) BLOCK — 오늘 철회한 2건이 정확히 걸린다.
--
-- 주의: B(수동 승인 링크 필수)를 적용하면 관리자 Vị trí 화면의 수동 승인은 근거 링크 입력란이
--   생기기 전까지 실패한다(현재 화면은 evidence_urls를 빈 배열로 보낸다).

create or replace function public.enforce_location_approval_evidence()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  in_kcn boolean;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;

  if new.evidence ~ '^\[Tự động' then
    if new.evidence ~ 'Tìm theo địa chỉ chi tiết trên VietMap'
       and new.evidence ~ 'VietMap ref: geocode:'
       and new.evidence ~ 'Địa chỉ VietMap:[^\n]*\d' then
      return new;
    end if;
    select exists(select 1 from public.job_work_locations w where w.job_id = new.job_id and w.industrial_park is not null)
      into in_kcn;
    if in_kcn and new.evidence ~ 'VietMap' then
      return new;
    end if;
    raise exception 'approval rejected: automatic approval without house-number evidence or KCN evidence (job %)', new.job_id
      using errcode = 'check_violation';
  end if;

  if coalesce(array_length(new.evidence_urls, 1), 0) = 0 then
    raise exception 'approval rejected: manual approval requires at least one evidence URL (job %)', new.job_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists job_location_candidates_approval_evidence on public.job_location_candidates;
create trigger job_location_candidates_approval_evidence
  before insert or update of status on public.job_location_candidates
  for each row execute function public.enforce_location_approval_evidence();

-- R2b: 공개 판정값(publish_gate_reason)을 수집 프로그램이 적어 보내는 대신 DB가 직접 계산한다 (Lee 2026-11-01 "진행해").
-- 기준은 수집기 gate_auto_publish(crawler/job_quality.py, 2026-09-05 정책)와 같고, 연락처는 CLAUDE.md 공고 수집 소스 규칙 1
-- ("사이트 안 연락처(전화·Zalo) 없는 크롤링 공고는 비공개")을 따른다.
--   근무지 정보 없음(위치 글자·모집지역·근무지 행 모두 없음) → 'no_address_text'
--   연락처 없음(전화·Zalo 숫자 8자리 이상 없음)                → 'no_application_path'
--   그 외                                                       → 'ok'
-- 누가 어떤 값을 적어 보내도 덮어쓴다. 수집 공고(crawler)는 'ok'가 아니면 공개할 수 없다.
-- 관리자 공고(admin)는 2026-10-14 결정 A대로 이 값으로 공개를 막지 않는다(계산 기록만).

create or replace function public.job_publish_gate_reason(j public.local_jobs) returns text
language sql stable set search_path = pg_catalog, public as $$
  select case
    when nullif(btrim(coalesce(to_jsonb(j) ->> 'location', '')), '') is null
         and coalesce(jsonb_array_length(case when jsonb_typeof(to_jsonb(j) -> 'recruitment_regions') = 'array' then to_jsonb(j) -> 'recruitment_regions' end), 0) = 0
         and not exists (select 1 from public.job_work_locations w where w.job_id = j.id)
      then 'no_address_text'
    when length(regexp_replace(coalesce(to_jsonb(j) ->> 'employer_phone', ''), '\D', '', 'g')) < 8
         and length(regexp_replace(coalesce(to_jsonb(j) ->> 'contact_zalo', ''), '\D', '', 'g')) < 8
      then 'no_application_path'
    else 'ok'
  end
$$;
revoke all on function public.job_publish_gate_reason(public.local_jobs) from public, anon, authenticated;

create or replace function public.enforce_job_publish_gate() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if coalesce(new.origin, '') not in ('crawler', 'admin') then return new; end if;
  new.publish_gate_reason := public.job_publish_gate_reason(new);
  if new.origin = 'crawler' and new.publish_gate_reason <> 'ok' and coalesce(new.active, false) then
    new.active := false;
  end if;
  return new;
end $$;
revoke all on function public.enforce_job_publish_gate() from public, anon, authenticated;

drop trigger if exists trg_zz0_publish_gate on public.local_jobs;
create trigger trg_zz0_publish_gate before insert or update on public.local_jobs
for each row execute function public.enforce_job_publish_gate();

-- 기존 공고에 계산값을 채운다(공개 상태는 바꾸지 않는 값만: 현재 공개 공고는 모두 'ok'임을 2026-11-01 읽기 조회로 확인).
update public.local_jobs set publish_gate_reason = public.job_publish_gate_reason(local_jobs)
where origin in ('crawler', 'admin') and publish_gate_reason is distinct from public.job_publish_gate_reason(local_jobs);

-- 규정 표: R2b 결정됨 → DB 트리거로 강제
update public.job_posting_rules
set content = 'publish_gate_reason은 DB가 직접 계산한다(누가 적어 보내도 덮어씀): 근무지 정보 없음 → no_address_text, 전화·Zalo 없음 → no_application_path, 그 외 ok. 수집 공고는 ok가 아니면 공개 불가. 관리자 공고는 계산 기록만(10-14 결정 A). (Lee 2026-11-01)',
    check_ref = array['trigger:trg_zz0_publish_gate'],
    block_mode = '보류', machine_checkable = '가능', implementation = 'trigger trg_zz0_publish_gate / job_publish_gate_reason()'
where rule_key = 'R2b_publish_gate_reason_code_only';

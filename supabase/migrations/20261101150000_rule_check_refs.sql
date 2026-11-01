-- 규정 = 검사 (2026-11-01 Lee "지적사항 전부 반영": 규정을 표에 적기만 하고 아무것도 막지 않는 일이 없게)
-- job_posting_rules.check_ref: 규정마다 실제로 지키게 하는 장치 목록.
--   trigger:<이름>   — public 스키마에 실제로 있는 DB 트리거(저장거부·보류)
--   inspect:<키>     — 공고 검사표 항목(src/lib/jobInspect.ts). job-inspect 실행기가 매번 키가 실제로 있는지 확인한다.
--   ci:<파일>        — PR 필수 검사에서 도는 시험 파일
--   decision_pending — Lee 결정 대기(구현 안 함)
--   decision_allow   — Lee가 "막지 않는다"고 정한 규정
--   work_rule        — 공고 데이터가 아니라 작업 방식 규정(CLAUDE.md), 공고 검사 대상 아님
-- 장치가 없는 규정은 저장할 수 없다(트리거). 이 파일 끝에서 모든 기존 규정에 장치가 있는지 확인하고, 없으면 전체 취소.

alter table public.job_posting_rules add column if not exists check_ref text[];

update public.job_posting_rules r set check_ref = v.refs
from (values
  ('R1_phone_digits_only',                    array['trigger:trg_zz_enforce_job_posting_rules']),
  ('R2_decision_columns_code_only',           array['trigger:trg_zz_enforce_job_posting_rules']),
  ('R2b_publish_gate_reason_code_only',       array['decision_pending']),
  ('R3_source_evidence_required',             array['trigger:trg_zz_enforce_job_posting_rules']),
  ('R4_policy_exclusion_trigger',             array['trigger:trg_enforce_job_posting_policy']),
  ('R5_verbatim_names',                       array['trigger:trg_zz_enforce_job_posting_rules']),
  ('R6_age_preserved',                        array['trigger:trg_zz_enforce_job_posting_rules']),
  ('R7_ocr_crosscheck',                       array['trigger:trg_zz_enforce_job_posting_rules', 'inspect:ocr']),
  ('R8_publication_requires_original_evidence', array['trigger:trg_zzzz_occupation_publication', 'inspect:occupation']),
  ('U1_industrial_park_pin_publish',          array['decision_pending']),
  ('U2_age_min_under_15',                     array['decision_allow']),
  ('L1_single_location_source',               array['trigger:trg_00_canonical_gate']),
  ('L2_single_location_writer',               array['trigger:trg_00_location_single_writer']),
  ('L3_derived_location_cache',               array['trigger:trg_location_refresh_cache']),
  ('L4_data_independent_location_tests',      array['ci:scripts/ci/location-test-policy.mjs']),
  ('R9_application_relevant_only',            array['work_rule']),
  ('R10_multi_role_conditions',               array['inspect:roles', 'inspect:benefits']),
  ('R11_original_hours_review',               array['inspect:hours_review']),
  ('R12_location_precision_review',           array['trigger:trg_02_administrative_pin', 'inspect:pin']),
  ('R13_role_readability_and_continuations',  array['inspect:promo_in_07'])
) as v(rule_key, refs)
where r.rule_key = v.rule_key;

-- 같은 이름으로 연결된 장치가 실제로 있는지까지 확인한다(트리거 이름 오타·삭제도 잡음).
create or replace function public.job_rule_check_ref_problem(refs text[]) returns text
language plpgsql stable set search_path = pg_catalog, public as $$
declare
  ref text;
begin
  if refs is null or cardinality(refs) = 0 then return '검사 장치 없음'; end if;
  foreach ref in array refs loop
    if ref in ('decision_pending', 'decision_allow', 'work_rule') then continue; end if;
    if ref ~ '^inspect:[a-z0-9_]+$' or ref ~ '^ci:[A-Za-z0-9_./-]+$' then continue; end if;
    if ref ~ '^trigger:[a-z0-9_]+$' then
      if not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and not t.tgisinternal and t.tgname = substr(ref, 9)) then
        return '없는 트리거: ' || ref;
      end if;
      continue;
    end if;
    return '알 수 없는 장치 형식: ' || ref;
  end loop;
  return null;
end $$;
revoke all on function public.job_rule_check_ref_problem(text[]) from public, anon, authenticated;

create or replace function public.enforce_job_rule_check_ref() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  problem text := public.job_rule_check_ref_problem(new.check_ref);
begin
  if problem is not null then
    raise exception 'job_rule_check_ref: 규정 % — % (규정은 검사 장치와 함께만 저장할 수 있음)', new.rule_key, problem;
  end if;
  return new;
end $$;
revoke all on function public.enforce_job_rule_check_ref() from public, anon, authenticated;

drop trigger if exists trg_job_rule_check_ref on public.job_posting_rules;
create trigger trg_job_rule_check_ref before insert or update on public.job_posting_rules
for each row execute function public.enforce_job_rule_check_ref();

-- 기존 규정 전부 확인: 하나라도 장치가 없으면 이 파일 전체를 취소한다.
do $$
declare
  bad text;
begin
  select string_agg(rule_key || ' (' || public.job_rule_check_ref_problem(check_ref) || ')', ', ') into bad
  from public.job_posting_rules where public.job_rule_check_ref_problem(check_ref) is not null;
  if bad is not null then raise exception 'job_rule_check_ref: 장치 없는 규정 — %', bad; end if;
end $$;

-- 20261101150000_rule_check_refs.sql 시험용 최소 표: 운영 규정 20개 이름과 같은 이름의 빈 트리거(존재 확인용).
create table if not exists public.job_posting_rules (id bigint generated always as identity primary key, rule_key text unique, content text);
create table if not exists public._trg_fixture (id int);
create or replace function public._noop() returns trigger language plpgsql as $$ begin return new; end $$;
do $$ declare t text; begin
  foreach t in array array['trg_zz_enforce_job_posting_rules','trg_enforce_job_posting_policy','trg_zzzz_occupation_publication','trg_00_canonical_gate','trg_00_location_single_writer','trg_location_refresh_cache','trg_02_administrative_pin'] loop
    execute format('drop trigger if exists %I on public._trg_fixture; create trigger %I before insert on public._trg_fixture for each row execute function public._noop()', t, t);
  end loop;
end $$;
insert into public.job_posting_rules(rule_key, content) select k, 'x' from unnest(array['R1_phone_digits_only','R2_decision_columns_code_only','R2b_publish_gate_reason_code_only','R3_source_evidence_required','R4_policy_exclusion_trigger','R5_verbatim_names','R6_age_preserved','R7_ocr_crosscheck','R8_publication_requires_original_evidence','U1_industrial_park_pin_publish','U2_age_min_under_15','L1_single_location_source','L2_single_location_writer','L3_derived_location_cache','L4_data_independent_location_tests','R9_application_relevant_only','R10_multi_role_conditions','R11_original_hours_review','R12_location_precision_review','R13_role_readability_and_continuations']) k on conflict do nothing;

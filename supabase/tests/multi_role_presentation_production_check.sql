-- Read-only rule presence. Semantic UI/layout and all-public pin checks run separately.
do $$ begin
 if not exists(select 1 from public.job_posting_rules where rule_key='R10_multi_role_conditions' and content like '%직무 수는 모집인원 수가 아니며%')
 or not exists(select 1 from public.job_posting_rules where rule_key='R12_location_precision_review' and content like '%10-13 핀 무조건%')
 or not exists(select 1 from public.job_posting_rules where rule_key='R13_role_readability_and_continuations' and content like '%07 기타란%') then
  raise exception 'approved multiple-role and source-area rules missing';
 end if;
end $$;

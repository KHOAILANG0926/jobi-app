-- 운영 점검(읽기 전용): 모든 공고 규정에 실제로 있는 검사 장치가 연결돼 있다.
do $check$
declare
  bad text;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.job_posting_rules'::regclass and tgname = 'trg_job_rule_check_ref' and tgenabled <> 'D')
  then raise exception 'trg_job_rule_check_ref 트리거 없음 또는 꺼짐'; end if;
  select string_agg(rule_key || ' (' || public.job_rule_check_ref_problem(check_ref) || ')', ', ') into bad
  from public.job_posting_rules where public.job_rule_check_ref_problem(check_ref) is not null;
  if bad is not null then raise exception '장치 없는 규정: %', bad; end if;
  raise notice 'rule_check_refs production check passed';
end $check$;

-- 20261101150000_rule_check_refs.sql 실제 PostgreSQL 시험(폐기용 DB). 장치 없는 규정·없는 트리거는 저장 거부.
do $test$
begin
  begin
    insert into public.job_posting_rules(rule_key, content) values ('X1_no_check', '시험');
    raise exception 'FAIL: 장치 없는 규정이 저장됨';
  exception when others then
    if sqlerrm not like 'job_rule_check_ref:%' then raise; end if;
  end;
  begin
    insert into public.job_posting_rules(rule_key, content, check_ref) values ('X2_bad_trigger', '시험', array['trigger:trg_does_not_exist']);
    raise exception 'FAIL: 없는 트리거 연결이 저장됨';
  exception when others then
    if sqlerrm not like 'job_rule_check_ref:%' then raise; end if;
  end;
  begin
    update public.job_posting_rules set check_ref = null where rule_key = 'R10_multi_role_conditions';
    raise exception 'FAIL: 기존 규정의 장치를 지울 수 있음';
  exception when others then
    if sqlerrm not like 'job_rule_check_ref:%' then raise; end if;
  end;
  insert into public.job_posting_rules(rule_key, content, check_ref) values ('X3_ok', '시험', array['inspect:roles']);
  delete from public.job_posting_rules where rule_key = 'X3_ok';
  raise notice 'rule_check_refs local test: 거부 3개·허용 1개 통과';
end $test$;

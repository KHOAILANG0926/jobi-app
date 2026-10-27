-- rules.sql 승격 시 supabase/tests/*_production_check.sql로 함께 제출.
-- 정상 migrations-apply 작업만 실행. Codex 운영 DB 직접 실행 금지.
begin;
do $$
begin
  if not exists (select 1 from public.job_posting_rules
    where rule_key='R8_publication_requires_original_evidence'
      and decided_on=date '2026-10-27'
      and position('Công việc cụ thể: chưa ghi trong tin gốc' in content)>0
      and position('공단 밖 또는 공장 여부 불명' in content)>0) then
    raise exception 'FUSHAN occupation rule update missing';
  end if;
  if public.job_occupation_publish_reason('9', E'Làm ngồi, phòng thường\nĐịa chỉ: VSIP',
      E'Công việc: Làm ngồi, phòng thường\nĐịa chỉ: VSIP - Bắc Ninh') <> 'ok' then
    raise exception 'FUSHAN official upper-level source evidence rejected';
  end if;
  if public.job_occupation_publish_reason(null, null, 'Địa chỉ: VSIP')='ok'
     or public.job_occupation_publish_reason('9', 'lắp ráp điện tử', 'Làm ngồi, phòng thường')='ok' then
    raise exception 'Occupation evidence protections weakened';
  end if;
end $$;
rollback;

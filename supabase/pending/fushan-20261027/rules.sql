-- Lee 2026-10-27 승인 결정. PGlite 검증 대상, 운영 미적용.
-- CLI로 migration 생성 후 본문을 이동하고 production_check와 같은 PR 제출.
-- 기존 R8 함수/트리거/권한/원문 부분문자열 검사는 완화하지 않는다.
begin;
do $$
begin
  if not exists (select 1 from public.occupation_master
                 where code='9' and level=1 and name_vi='Lao động giản đơn') then
    raise exception 'FUSHAN preflight: official top-level occupation 9 missing or changed';
  end if;
  if not exists (select 1 from public.job_posting_rules
                 where rule_key='R8_publication_requires_original_evidence') then
    raise exception 'FUSHAN preflight: R8 rule missing';
  end if;
end $$;
update public.job_posting_rules
set content = '공개 전 원문 근거로 확인 가능한 단계까지 공식 occupation_master 코드(1~5단계)를 붙인다. 2026-10-27 Lee: KCN/VSIP 등 공단의 공장 공고임이 확인되었으나 실제 업무가 미기재이면 가장 상위의 근거 있는 공식 코드만 사용하고, 그 이유만으로 비공개하지 않는다. 업무 칸에 Công việc cụ thể: chưa ghi trong tin gốc 표시. FUSHAN은 최상위 9(Lao động giản đơn), 원문 Làm ngồi, phòng thường와 VSIP를 함께 근거로 보존한다. 공단 밖 또는 공장 여부 불명은 기존 미분류 비공개. 공단명만으로 공장을 확정하거나 조립/기계 운전을 추정하지 않는다. 새 코드 생성 금지. 원문 근거 누락/변조는 계속 보류. 코드·부분문자열 검사는 의미 일치의 자동 증명이 아님.',
    decided_on = date '2026-10-27'
where rule_key='R8_publication_requires_original_evidence';
commit;

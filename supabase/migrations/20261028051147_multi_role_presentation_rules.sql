-- Lee 2026-10-28: approved text mockup; common presentation only, no job overrides.
begin;
do $$ begin
 if (select count(*) from public.job_posting_rules where rule_key in ('R10_multi_role_conditions','R12_location_precision_review'))<>2 then
  raise exception 'presentation rules preflight: previous decisions missing';
 end if;
end $$;
update public.job_posting_rules set content='원문 하나에 여러 직무가 있어도 공고 1개다. 승인된 KDA 상단 칸 위치·크기·순서를 유지하고 근무시간은 직무별 다름과 직무 수, 근무형태는 원문 Full time/Part time, 휴무는 직무별 원문/미기재를 요약한다. 직무 수는 모집인원 수가 아니며 인원 미기재를 구분한다. 상단 급여는 Theo từng vị trí (N vị trí) — xem chi tiết이며 통합 숫자 범위·시간·인원을 만들지 않는다. 복리후생은 해당 직무만 표시한다. 상세요강 기존 항목별 칸 안에서 직무별로 묶고 이름은 묶음 제목에 한 번만 쓴다. 저장된 원문·기존 공고도 같은 공통 표시 경로를 사용한다.',
 decided_on=date '2026-10-28',implementation='jobRolePresentation.ts / JobDetail.tsx / ensureJobFields / multi-role regression and browser tests'
where rule_key='R10_multi_role_conditions';
update public.job_posting_rules set content='10-13 핀 무조건, 10-14 번지→회사+공단→공단 입구→동 중심 순서표를 확정 전에도 적용한다. 더 높은 정확도 근거를 보존하고 미확정이면 원문 성/시 안의 가능한 대략 행정 중심을 canonical writer에 area·미확인으로 기록하여 main/detail 같은 핀을 보여준다. chưa xác minh 정확도를 표시하고 관리자 위치 확정 목록에도 남긴다. 임의 매장 좌표·전국 기본 중심을 실제 근무지 핀으로 만들지 않는다. 원문 성/시를 증명할 수 없는 위치는 시험 실패·확인 대상으로 보고한다.',
 decided_on=date '2026-10-28',implementation='canonical location writer / administrativeArea / all-public source-area oracle'
where rule_key='R12_location_precision_review';
insert into public.job_posting_rules(rule_key,content,decided_on,machine_checkable,block_mode,implementation)
values('R13_role_readability_and_continuations','권유 문구(Gia nhập đội ngũ…, Ứng tuyển sớm…)는 10-20 결정대로 07 기타란에 둔다. + thưởng + tip 같은 이어지는 조각은 같은 직무의 앞 급여 줄에 결합한다. 서로 다른 직무의 조건을 합치거나 원문 숫자·글자를 고치지 않는다. 기존 저장된 접두 직무 이름도 공통 표시 단계에서 묶음으로 바꾼다.',date '2026-10-28','가능','없음','jobDescriptionBuild.ts / jobDetailSections.ts / jobRolePresentation.ts / tests')
on conflict(rule_key) do update set content=excluded.content,decided_on=excluded.decided_on,implementation=excluded.implementation;
commit;

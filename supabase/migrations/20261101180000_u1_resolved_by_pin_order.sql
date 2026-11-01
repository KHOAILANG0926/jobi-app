-- U1(공단명만 있는 공고의 "공단 입구 대표 핀" 공개 여부) 정리 — 이미 확정된 Lee 결정으로 답이 나와 있다:
--   2026-10-13 핀 무조건, 2026-10-14 위치 순서표(번지 → 회사+공단 → 공단 입구 → …, 정확도 표시),
--   2026-10-28 확정 전에도 대략 위치를 chưa xác minh로 표시하고 관리자 위치 확정 대기 유지(CLAUDE.md).
-- → 공단 입구 핀은 정확도 표시와 함께 공개를 막지 않는다(decision_allow). 화면·데이터 변경 없음, 규정 표 기록만.
update public.job_posting_rules
set content = '결정됨(2026-10-13·10-14·10-28 Lee): 공단명만 있는 공고는 공단 입구 대표 핀을 정확도(chưa xác minh)와 함께 공개한다. 공개를 막지 않고 관리자 위치 확정 대기를 유지한다.',
    check_ref = array['decision_allow']
where rule_key = 'U1_industrial_park_pin_publish';

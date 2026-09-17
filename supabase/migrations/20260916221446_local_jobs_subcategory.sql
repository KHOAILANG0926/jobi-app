-- 업직종 소분류 (2026-09-16 사용자 지시) — 대분류(category) 8개 안에서 더
-- 세분화한 값. crawler/classifier.py의 classify_subcategory()가 채우며,
-- 규칙이 없거나 안 걸리면 NULL(소분류 없음) — 강제로 끼워맞추지 않는다.
-- 값은 crawler/classifier.py의 SUBCATEGORY_LABELS 키(예: 'pha_che',
-- 'thu_ngan')와 1:1로 대응하는 안정적인 식별자이지, 그대로 화면에 보여줄
-- 라벨 문자열이 아니다 — 프론트에서 표시할 때는 SUBCATEGORY_LABELS와 동일한
-- 매핑을 따로 둔다.
alter table public.local_jobs
  add column if not exists subcategory text;

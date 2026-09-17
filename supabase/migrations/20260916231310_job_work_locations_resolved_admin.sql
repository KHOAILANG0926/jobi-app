-- 베트남 2025-07-01 행정구역 개편(군/구 폐지, 성/시 63→34, 동/사 재편) 반영
-- (2026-09-16 사용자 지시). 기존 province/district는 Geoapify가 반환한 원문 그대로
-- 남겨두고(디버깅/감사용, 옛/새 이름이 섞여 있을 수 있음 — 실측 확인됨), 이 두
-- 컬럼은 crawler/vn_provinces_lookup.py(통계총국 공식 자료 기반 vietnam-provinces
-- 패키지)로 확정한 "지금 유효한" 값만 담는다.
alter table public.job_work_locations
  add column if not exists resolved_province text,
  add column if not exists resolved_wards text[];

comment on column public.job_work_locations.resolved_province is
  '2025-07-01 개편 반영, 지금 유효한 성/시 34개 중 하나(vietnam-provinces 패키지로 확정)';
comment on column public.job_work_locations.resolved_wards is
  '지금 유효한 동/사 후보(옛 군/구 하나가 여러 동으로 쪼개진 경우 여러 개일 수 있음) — 하나로 단정 못 하면 여러 후보를 그대로 보존';

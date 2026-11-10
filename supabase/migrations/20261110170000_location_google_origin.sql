-- Lee 2026-11-09 "Google 데이터와 자체 검증 데이터 분리", 2026-11-10 3단계 "관리·재사용 기준 정비".
-- 공고 위치 원본(job_work_locations)의 출처 표시가 Google 좌표를 'source_evidence'(기타)로 뭉뚱그려 Google 자료와 우리 자료를 구분할 수 없었다.
-- 앞으로 기록되는 위치부터 Google 출처를 'Google'로 남긴다. 순서는 그대로라 VietMap 번지 검증(exact)은 계속 'VietMap', 관리자 확정은 'admin_approved'.
-- 기존 위치 줄·좌표·핀은 바꾸지 않는다(Lee 2026-11-10 기존 좌표 변경 금지). 화면은 출처 글자를 보여 주지 않는다(위치는 위치일 뿐).
create or replace function location_private.safe_source(p_source text) returns text language sql immutable
set search_path=pg_catalog as $$select case
 when p_source ilike '%vietmap%' then 'VietMap'
 when p_source ilike '%openstreetmap%' or p_source ilike '%osm%' then 'OpenStreetMap'
 when p_source='admin_approved' then 'admin_approved'
 when p_source='poster_pin' then 'poster_pin'
 when p_source ilike 'google%' then 'Google'
 else 'source_evidence' end$$;

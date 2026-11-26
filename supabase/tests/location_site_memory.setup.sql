-- 시험 DB 준비(폐기용, 운영 아님): 20261126090000_location_site_memory 시험.
-- 같은 사업장 판정(same_site_address)은 운영 본문 그대로 — 20261124150000과 그 준비를 다시 쓴다.
\i supabase/tests/location_same_site_keep.setup.sql
\i supabase/migrations/20261124150000_location_same_site_keep.sql
-- 운영과 같은 출처 표시(Google 좌표는 'Google', 20261110170000 글자 그대로).
\i supabase/migrations/20261110170000_location_google_origin.sql

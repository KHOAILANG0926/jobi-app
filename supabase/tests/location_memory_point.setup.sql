-- 시험 DB 준비(폐기용, 운영 아님): CI 기본 위치 시험 틀(postgres-location-fixture·reference-location-fixed)에 없는
-- 회사 이름 열쇠 함수만 운영과 같은 정의로 둔다(20261026231445_location_single_source.sql).
create schema if not exists location_private;
create or replace function location_private.company_identity(p_text text) returns text language sql immutable
set search_path=pg_catalog as $$select lower(regexp_replace(btrim(normalize(coalesce(p_text,''),NFC)),'[[:space:]]+',' ','g'))$$;

-- local_jobs 열 단위 읽기 권한 (2026-10-14 사용자 결정, Production 적용은 사용자 승인 후)
-- 목적: anon·authenticated가 REST로 읽을 수 없어야 하는 열을 실제로 막는다.
--   source_url, source_text, ocr_text, ocr_check, guest_manage_token
-- 배경(기존 보안 구멍): 20260920120000_local_jobs_guest_posting.sql 이 `revoke select (guest_manage_token)`을 걸었지만,
--   0005/0009 가 테이블 단위 `grant select on local_jobs to anon, authenticated`를 이미 줬기 때문에 열 REVOKE는 효과가 없었다
--   (Postgres는 테이블 단위 권한이 있으면 열 단위 REVOKE를 무시한다). 2026-10-14 운영 DB에서 anon이 guest_manage_token을 읽을 수 있음을 확인.
-- 방식: 테이블 단위 SELECT를 걷고, 위 5개를 뺀 나머지 열에만 SELECT를 다시 준다.
-- 앱 영향: src·api는 local_jobs를 select('*')로 읽지 않고 위 5개 열도 선택하지 않는다(2026-10-14 전수 확인). service_role·소유자 계정(Actions)은 영향 없음.
-- 주의: 이후 local_jobs에 열을 추가하면 anon·authenticated는 그 열을 자동으로 읽지 못한다. 공개해도 되는 열이면 새 마이그레이션에서
--   `grant select (새열) on public.local_jobs to anon, authenticated;`를 함께 넣어야 한다(비공개 열은 아무것도 하지 않으면 된다).
-- 멱등: 여러 번 실행해도 같은 결과.

revoke select on public.local_jobs from anon, authenticated;

do $do$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'local_jobs'
     and column_name not in ('source_url', 'source_text', 'ocr_text', 'ocr_check', 'guest_manage_token');
  execute format('grant select (%s) on public.local_jobs to anon, authenticated', cols);
end $do$;

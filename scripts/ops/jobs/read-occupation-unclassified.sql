-- C 작업(직업분류, #701 로드맵 5번·#717): 직업코드가 없는 공고 조회. 읽기 전용(데이터 변경 없음).
-- 2026-11-26: #1098(occupation-r8-apply 재실행) 승인 전 확인용으로, 그 워크플로가 고르는 것과 **같은 조회**(rows.json)를 그대로 찍는다
--   → 같은 backfill_occupations.py로 실제 바뀔 공고·코드를 미리 계산한다(운영 쓰기 없음). 공개 상태(active·admin_hidden)도 함께.
-- 실행: ops-run-sql.yml(master, Lee 계정 수동, name=read-occupation-unclassified). 출력은 실행 로그에만(원본 사이트 주소는 조회하지 않음).
set transaction read only;
\pset tuples_only on
\pset format unaligned
select 'ROWS_JSON ' || coalesce(json_agg(json_build_object('id', id, 'title', title, 'source_text', source_text, 'created_at', created_at)), '[]') from public.local_jobs where occupation_code is null;
select 'STATE ' || id || ' active=' || coalesce(active::text, 'null') || ' hidden=' || coalesce(admin_hidden::text, 'null') || ' origin=' || coalesce(origin, '-') || ' created=' || created_at from public.local_jobs where occupation_code is null order by id;

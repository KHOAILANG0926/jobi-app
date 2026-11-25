-- C 작업(직업분류, #701 로드맵 5번): 직업코드가 없는 공고의 원문을 보고 같은 직무가 반복되는지·실제 업무를 특정할 수 있는지 판단하기 위한 조회.
-- 규칙 추가는 원문으로 실제 업무가 확인되는 반복 직무만(억지 분류 금지, 11-15 주간 자동 보강 중단 그대로). 읽기 전용(데이터 변경 없음).
-- 실행: ops-run-sql.yml(master, Lee 계정 수동, name=read-occupation-unclassified). 출력은 실행 로그에만(원본 사이트 주소는 조회하지 않음). 최근 60건, 원문 앞 700자.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select string_agg('=====#' || id || ' · active ' || coalesce(active, false) || ' · hidden ' || coalesce(admin_hidden, false)
  || ' · origin ' || coalesce(origin, '-') || ' · 제목 ' || coalesce(title, '') || ' · 회사 ' || coalesce(company, '') || chr(10)
  || left(coalesce(source_text, '(원문 없음)'), 700), chr(10) order by id desc)
from (select * from public.local_jobs where occupation_code is null order by id desc limit 60) j;

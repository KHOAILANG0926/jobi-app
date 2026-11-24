-- R 트랙(#872·#940) 1단계: 공고 6337의 빈 이름표 'VỊ TRÍ:' 원인을 원문으로 재현하기 위한 원문 조회. 근본 원인·수정 대상은 이 원문으로 재현한 뒤에만 확정한다.
-- 읽기 전용(데이터 변경 없음). 실행: ops-run-sql.yml(master, Lee 계정 수동, name=read-job-6337-source). 출력은 실행 로그에만 남는다(원본 사이트 주소는 조회하지 않는다).
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '=====6337 상태===== active ' || active || ' · admin_hidden ' || coalesce(admin_hidden, false) || ' · source ' || coalesce(source, '없음') || ' · 제목 ' || coalesce(title, '') from public.local_jobs where id = 6337;
select '=====6337 원문(source_text) 시작=====' || chr(10) || coalesce(source_text, '(없음)') || chr(10) || '=====원문 끝=====' from public.local_jobs where id = 6337;
select '=====6337 상세요강(description) 시작=====' || chr(10) || coalesce(description, '(없음)') || chr(10) || '=====상세요강 끝=====' from public.local_jobs where id = 6337;

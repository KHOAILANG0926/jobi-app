-- Proposed rule-table entries, not executed on production.
do $$begin if current_database()<>'location_single_source_dryrun' then
 raise exception 'REVIEW ONLY: Lee approval and completed cutover required'; end if;end$$;
insert into public.job_posting_rules(rule_key,content,decided_on,machine_checkable,block_mode,implementation)
values
 ('L1_single_location_source','공고 위치의 원본은 job_work_locations 하나. 후보/기억/공급자 응답을 별도 화면 좌표 원본으로 쓰지 않는다.','2026-10-26','가능','저장거부','원본 제약 + 메인/상세/원본 점 집합 전수 검사'),
 ('L2_single_location_writer','확정·재사용·자동 위치·작성자 핀·수집 좌표는 private 단일 쓰기 함수만 통과. 직접 쓰기는 권한/트리거로 차단한다.','2026-10-26','가능','저장거부','location_private.write_location + NOLOGIN 역할 + guard_source_write'),
 ('L3_derived_location_cache','지도 캐시는 원본 트리거로 갱신. 유효한 확정 기억은 동일 회사/주소에 자동 반영. 불일치는 저녁 8시 보고한다.','2026-10-26','가능','저장거부','원본→캐시 트리거 / location_integrity_issues / 기존 저녁 보고'),
 ('L4_data_independent_location_tests','운영 위치 시험은 특정 공고 번호·회사명·건수에 의존하지 않는다. 모든 공개 공고의 점 집합·정밀도를 원본과 대조한다.','2026-10-26','가능','없음','CI 정적 검사 + 동적 전수 검사 + 비공개 생성 ID E2E')
on conflict(rule_key) do update set content=excluded.content,decided_on=excluded.decided_on,
 machine_checkable=excluded.machine_checkable,block_mode=excluded.block_mode,implementation=excluded.implementation;
-- Do not set last_test_result to success merely because a rule row exists.

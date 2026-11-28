-- 단건 게시 후보 확인(Lee 2026-11-28): 기존 위치 보류함(research_artifacts, kind=location-hold)에 연락처가 있는 정상 공고 후보가 있는지 읽기만 한다.
-- 읽기 전용(데이터 변경 없음). 실행: ops-run-sql.yml(master, Lee 계정 수동, name=location-hold-candidates-read). run-sql-plan이 읽기 전용 트랜잭션을 건다.
-- 개인정보: 전화·Zalo 번호·원문 글은 출력하지 않는다(연락처는 8자리 이상 숫자가 있는지 '있음/없음'만). 회사 이름·시·성 단위 지역·보류 사유·상태·횟수만 보여 준다.
-- 후보 기준(규정 그대로): 연락처 있음 + 상태 unfound/held/review(아직 등록 안 됨) — 위치는 보류 사유 그대로이므로 위치를 찾지 못하면 공개 못 함(대략 위치로 대신하지 않음). 이 파일은 후보 수와 사유만 보여 줄 뿐 등록·상태 변경을 하지 않는다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '::notice::[보류함 상태·사유별 건수] ' || coalesce(string_agg(s || ' ' || r || ' ' || n || '건(연락처 있음 ' || c || ')', ' · ' order by s, r), '없음')
  from (select coalesce(meta->>'status', '?') as s, coalesce(nullif(meta->>'reason', ''), '-') as r, count(*) as n,
               count(*) filter (where length(regexp_replace(coalesce(payload->>'employer_phone', '') || coalesce(payload->>'contact_zalo', ''), '[^0-9]', '', 'g')) >= 8) as c
          from public.research_artifacts where kind = 'location-hold' group by 1, 2) t;
select '::notice::[후보 행] 상태 ' || coalesce(meta->>'status', '?') || ' · 사유 ' || coalesce(nullif(meta->>'reason', ''), '-') || ' · 확인 횟수 ' || coalesce(meta->>'attempts', '0')
       || ' · 보관 ' || coalesce(left(meta->>'held_at', 10), '?') || ' · 소스 ' || coalesce(payload->>'source', '?')
       || ' · 회사 ' || left(coalesce(payload->>'company', '없음'), 50) || ' · 지역 ' || left(coalesce(payload->>'location', '없음'), 40)
       || ' · 급여 ' || left(coalesce(payload->>'salary', '없음'), 30) || ' · 연락처 있음'
  from public.research_artifacts
 where kind = 'location-hold' and coalesce(meta->>'status', '') in ('unfound', 'held', 'review')
   and length(regexp_replace(coalesce(payload->>'employer_phone', '') || coalesce(payload->>'contact_zalo', ''), '[^0-9]', '', 'g')) >= 8
 order by meta->>'held_at' desc
 limit 30;

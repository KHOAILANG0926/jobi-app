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
-- 사전 검증용 불리언(Lee 2026-11-28, 후보 4건): 공개 저장소의 실행 로그에는 전화번호·원문을 찍을 수 없어 '조건 충족 여부'만 계산해 보여 준다. 위치 확정 좌표는 보류함 사유(위 줄)가 곧 결과이며 여기서 새로 찾지 않는다.
-- 전화: 숫자만 남겨 앞 84를 0으로 바꾼 뒤 10자리·0으로 시작·둘째 자리 2/3/5/7/8/9면 유효한 베트남 번호로 본다(번호 자체는 출력하지 않음). 급여·주소 글자·사진·중복은 원문·보류 줄의 칸에서 있음/없음만 계산한다.
select '::notice::[사전 검증] 회사 ' || left(coalesce(payload->>'company', '없음'), 40) || ' · 상태 ' || coalesce(meta->>'status', '?') || ' · 사유 ' || coalesce(nullif(meta->>'reason', ''), '-')
       || ' · 전화 유효 ' || (case when length(d.phone) = 10 and substr(d.phone, 1, 1) = '0' and substr(d.phone, 2, 1) in ('2', '3', '5', '7', '8', '9') then '예' else '아니오' end)
       || ' · Zalo 칸 ' || (case when length(regexp_replace(coalesce(payload->>'contact_zalo', ''), '[^0-9]', '', 'g')) >= 9 then '있음' else '없음' end)
       || ' · 제목 ' || (case when length(coalesce(payload->>'title', '')) > 3 then '있음' else '없음' end)
       || ' · 원문 길이 ' || length(coalesce(payload->>'source_text', ''))
       || ' · 급여 표시 ' || (case when length(coalesce(payload->>'salary', '')) > 0 then '칸에 있음' when coalesce(payload->>'source_text', '') ~* '(triệu|tr/|[0-9]k|lương|luong|[0-9][.,][0-9]{3})' then '원문에만 있음' else '없음' end)
       || ' · 주소 글자 ' || (case when length(coalesce(payload->>'location', '')) >= 10 or coalesce(payload->>'source_text', '') ~* '(số |so [0-9]|đường|duong|phố|pho |ngõ|ngo |phường|phuong|xã |kcn|khu công nghiệp|khu cong nghiep|quận|quan |huyện|huyen)' then '있음' else '없음' end)
       || ' · 사진 ' || (case when jsonb_typeof(payload->'images') = 'array' and jsonb_array_length(payload->'images') > 0 then '있음' else '없음' end)
       || ' · 같은 회사·같은 번호 기존 공고 ' || (select count(*) from public.local_jobs l where lower(l.company) = lower(coalesce(payload->>'company', '')) and regexp_replace(coalesce(l.employer_phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(payload->>'employer_phone', ''), '[^0-9]', '', 'g')) || '건'
       || ' · 확인 횟수 ' || coalesce(meta->>'attempts', '0') || ' · 다음 확인 ' || coalesce(left(meta->>'next_at', 10), '?')
  from public.research_artifacts r, lateral (select regexp_replace(regexp_replace(coalesce(r.payload->>'employer_phone', ''), '[^0-9]', '', 'g'), '^84', '0') as phone) d
 where r.kind = 'location-hold' and coalesce(r.meta->>'status', '') in ('unfound', 'held', 'review')
   and length(regexp_replace(coalesce(r.payload->>'employer_phone', '') || coalesce(r.payload->>'contact_zalo', ''), '[^0-9]', '', 'g')) >= 8
 order by r.meta->>'held_at' desc
 limit 30;

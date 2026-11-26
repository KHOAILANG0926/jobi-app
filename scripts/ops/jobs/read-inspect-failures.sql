-- 웹 정상화(#701): 검사표(ocr_check.inspect)에서 어떤 항목이 가장 많이 실패하는지 — 새 공고가 공개 판정을 못 넘는 공통 원인을 찾기 위한 조회.
-- 읽기 전용(데이터 변경 없음). 대상: 자동 처리 기준 시각(config/auto-processing-cutoff.json 2026-11-01 09:15 UTC) 이후 수집·관리자 공고, 관리자 숨김 제외.
-- 실행: ops-run-sql.yml(master, Lee 계정 수동, name=read-inspect-failures). 출력은 실행 로그에만(원문·연락처·원본 주소는 찍지 않음).
set transaction read only;
\pset tuples_only on
\pset format unaligned
select 'TOTAL ' || count(*) || ' active=' || count(*) filter (where active) || ' inspected=' || count(*) filter (where ocr_check ? 'inspect') from public.local_jobs where origin in ('crawler', 'admin') and created_at > '2026-11-01T09:15:00Z' and not admin_hidden;
select 'FAIL ' || k || ' | ' || l || ' | reviewOnly=' || r || ' | ' || n || '건 | 예: ' || ids from (select coalesce(i->>'key', '?') as k, coalesce(i->>'label', '') as l, coalesce(i->>'reviewOnly', 'false') as r, count(*) as n, array_to_string((array_agg(j.id order by j.id desc))[1:5], ',') as ids from public.local_jobs j cross join lateral jsonb_array_elements(coalesce(j.ocr_check->'inspect'->'items', '[]'::jsonb)) i where j.origin in ('crawler', 'admin') and j.created_at > '2026-11-01T09:15:00Z' and not j.admin_hidden and coalesce((i->>'ok')::boolean, true) = false group by 1, 2, 3) t order by n desc;

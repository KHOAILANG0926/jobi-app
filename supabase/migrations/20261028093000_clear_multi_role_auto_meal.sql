-- 결정 0006(Lee 2026-10-28): 여러 직무 공고(직무 이름 줄머리 2종 이상)에서 AI 복리후생 판정이 자동으로 켠
-- 공고 전체 식사 칸(meal_provided=true)을 비운다(null = 미확인). 직무별 식사는 상세요강 원문 줄로 계속 표시된다.
-- 공통 규칙: 공고 번호·회사 고정 없음. Lee가 직접 고른 값(ocr_check.lee_benefits)은 건드리지 않는다.
-- 대상 조건은 supabase/tests/area_pin_hold_meal_production_check.sql 2번 검사와 같다.
begin;
do $$ begin
 if (select count(*) from information_schema.columns where table_schema='public' and table_name='local_jobs'
     and column_name in ('meal_provided','description','ocr_check'))<>3 then
  raise exception 'multi-role meal clear preflight: local_jobs columns missing';
 end if;
end $$;
do $$ declare n integer; begin
 update public.local_jobs j set meal_provided = null
 where j.meal_provided is true
  and coalesce(j.ocr_check->'benefits_ai'->'found','[]'::jsonb) @> '[{"code":"meal_provided"}]'::jsonb
  and not coalesce(j.ocr_check->'lee_benefits','[]'::jsonb) @> '[{"code":"meal_provided"}]'::jsonb
  and (select count(distinct lower(m[1])) from regexp_matches(coalesce(j.description,''),'^(.+\s+(?:full|part)[ -]?time)\s+—\s+','gin') m)>=2;
 get diagnostics n = row_count;
 raise notice 'multi-role automatic meal flag cleared: % job(s)', n;
end $$;
commit;

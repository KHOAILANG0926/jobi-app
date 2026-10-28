-- Read-only. Rule checks over ALL announcements (no fixed job id/company/count).
-- On failure the error lists each job id and the differing values.
do $check$
declare diff text;
begin
 -- 1) canonical pin(area 이상)이 있는 공개 대상(admin_hidden=false) 공고는 "위치 못 찾음" 보류에 있으면 안 된다.
 select string_agg(format('#%s: map_r1_unlocated(reason=%s, prev_active=%s) 운영 active=%s 기대=보류 없음',
   u.job_id,u.reason,u.prev_active,j.active),'; ' order by u.job_id)
 into diff
 from public.map_r1_unlocated u join public.local_jobs j on j.id=u.job_id
 where not j.admin_hidden and public.map_r1_has_canonical_pin(u.job_id);
 if diff is not null then
  raise exception 'area pin hold check: canonical pin job held as unlocated — %',diff;
 end if;

 -- 2) 여러 직무 공고(직무 이름 줄머리 2종 이상)에는 AI가 자동으로 켠 공고 전체 식사 칸이 없어야 한다(결정 0006).
 select string_agg(format('#%s: meal_provided 운영=true 기대=null (AI 자동, 직무 %s개)',x.id,x.roles),'; ' order by x.id)
 into diff
 from (
  select j.id,(select count(distinct lower(m[1])) from regexp_matches(coalesce(j.description,''),'^(.+\s+(?:full|part)[ -]?time)\s+—\s+','gin') m) roles
  from public.local_jobs j
  where j.meal_provided is true
   and coalesce(j.ocr_check->'benefits_ai'->'found','[]'::jsonb) @> '[{"code":"meal_provided"}]'::jsonb
   and not coalesce(j.ocr_check->'lee_benefits','[]'::jsonb) @> '[{"code":"meal_provided"}]'::jsonb  -- Lee가 직접 고른 값은 자동이 아님
 ) x
 where x.roles>=2;
 if diff is not null then
  raise exception 'multi-role meal check: automatic global meal flag — %',diff;
 end if;
end $check$;

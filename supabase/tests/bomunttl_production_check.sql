-- Read-only. Ship in supabase/tests with BOTH migrations, never execute through a direct DB session.
do $check$
declare j public.local_jobs; n integer; diff text;
begin
 select count(*) into n from public.job_posting_rules where rule_key in
 ('R3_source_evidence_required','R9_application_relevant_only','R10_multi_role_conditions','R11_original_hours_review','R12_location_precision_review');
 if n<>5 then raise exception 'Bomunttl check: required rules missing'; end if;
 select count(*) into n from public.local_jobs where company='Bomunttl' and public.job_phone_digits(employer_phone)='0365447485';
 if n<>1 then raise exception 'Bomunttl check: expected one announcement, got %',n; end if;
 select * into strict j from public.local_jobs where company='Bomunttl' and public.job_phone_digits(employer_phone)='0365447485';
 -- Same criteria as before; on failure every differing column is listed with
 -- operational (actual) and expected values so the cause is visible in the log.
 -- Template for other *_production_check.sql: compare to_jsonb(row)->key with an expected jsonb.
 select string_agg(format('%s: 운영값=%s 기대값=%s',e.key,coalesce(to_jsonb(j)->e.key,'null'::jsonb),e.value),'; ' order by e.key)
 into diff
 from jsonb_each(jsonb_build_object(
  'source','Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김',
  'source_url',null,'images','[]'::jsonb,
  'salary','Theo vị trí — xem chi tiết','salary_min',null,'salary_max',null,
  'posted_at',null,'salary_period',null,'hours',null,'meal_provided',null,
  'category','am_thuc_do_uong','occupation_code','9402','occupation_evidence','CÔ RỬA BÁT',
  'active',true,'admin_hidden',false)) e
 where (to_jsonb(j)->e.key) is distinct from e.value;
 if diff is not null then
  raise exception 'Bomunttl check: source/role fields/publication differ — %',diff;
 end if;
 if position('CÔ RỬA BÁT FULL TIME — (tg: 10h - 10h)' in coalesce(j.description,''))=0
 or position('NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Mức lương: 30k-35k/ 1h' in coalesce(j.description,''))=0
 or position('CÔ RỬA BÁT FULL TIME — Bao ăn 2 bữa' in coalesce(j.description,''))=0 then
  raise exception 'Bomunttl check: original role conditions missing';
 end if;
 if not exists(select 1 from public.job_work_locations where job_id=j.id and raw_address='Ngô Tất Tố - TP. Bắc Ninh') then
  raise exception 'Bomunttl check: canonical source address missing';
 end if;
 -- Do not demand an unresolved point forever: subsequent normal administrator confirmation is allowed.
 if exists(select 1 from public.job_work_locations where job_id=j.id
  and (lat is not null or lng is not null) and point_kind='unresolved') then
  raise exception 'Bomunttl check: unresolved address has a fabricated point';
 end if;
end $check$;

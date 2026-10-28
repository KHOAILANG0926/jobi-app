-- Read-only. Ship in supabase/tests with BOTH migrations, never execute through a direct DB session.
do $check$
declare j public.local_jobs; n integer;
begin
 select count(*) into n from public.job_posting_rules where rule_key in
 ('R3_source_evidence_required','R9_application_relevant_only','R10_multi_role_conditions','R11_original_hours_review','R12_location_precision_review');
 if n<>5 then raise exception 'Bomunttl check: required rules missing'; end if;
 select count(*) into n from public.local_jobs where company='Bomunttl' and public.job_phone_digits(employer_phone)='0365447485';
 if n<>1 then raise exception 'Bomunttl check: expected one announcement, got %',n; end if;
 select * into strict j from public.local_jobs where company='Bomunttl' and public.job_phone_digits(employer_phone)='0365447485';
 if j.source is distinct from 'Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김'
 or j.source_url is not null or j.images is distinct from '[]'::jsonb
 or j.salary is distinct from 'Theo vị trí — xem chi tiết' or j.salary_min is not null or j.salary_max is not null
 or j.posted_at is not null or j.salary_period is not null or j.hours is not null or j.meal_provided is not null
 or j.category is distinct from 'am_thuc_do_uong' or j.occupation_code is distinct from '9402' or j.occupation_evidence is distinct from 'CÔ RỬA BÁT'
 or j.active is distinct from true or j.admin_hidden is distinct from false then
  raise exception 'Bomunttl check: source/role fields/publication differ';
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

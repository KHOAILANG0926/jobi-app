-- B: keep inspection evidence tied to exact content. No location rows changed.
create or replace function public.job_inspect_content_hash(j public.local_jobs) returns text
language sql stable set search_path = pg_catalog, public as $$
  select md5(jsonb_build_object(
    'title',j.title,'company',j.company,'salary',j.salary,
    'description',j.description,'images',j.images,'source_text',j.source_text,
    'ocr_text',j.ocr_text,'location',j.location,
    'employer_phone',j.employer_phone,'contact_zalo',j.contact_zalo,
    'category',j.category,'occupation_code',j.occupation_code,
    'hours',j.hours,'work_days',j.work_days,
    'age_requirement',j.age_requirement,'gender_requirement',j.gender_requirement,
    'education',j.education,'preference',j.preference,'num_hires',j.num_hires,
    'language_requirement',j.language_requirement,'required_documents',j.required_documents,
    'shuttle_bus',j.shuttle_bus,'dormitory',j.dormitory,'meal_provided',j.meal_provided
  )::text)
$$;
revoke all on function public.job_inspect_content_hash(public.local_jobs) from public, anon, authenticated;
-- DB job-inspect runner uses the postgres role.
create or replace function public.job_inspect_is_current(j public.local_jobs) returns boolean
language sql stable set search_path = pg_catalog, public as $
  select coalesce(
    j.ocr_check->'inspect'->>'content_hash' = public.job_inspect_content_hash(j)
    and (j.ocr_check->'inspect'->>'ok')::boolean = true,
    false
  )
$;
revoke all on function public.job_inspect_is_current(public.local_jobs) from public, anon, authenticated;

create or replace function public.enforce_job_inspect_current() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.origin not in ('crawler','admin') then return new; end if;
  -- Any stale or failed inspection must not support publication.
  if coalesce(new.active,false) and not public.job_inspect_is_current(new) then
    new.active := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_zzz_inspect_current on public.local_jobs;
create trigger trg_zzz_inspect_current before insert or update on public.local_jobs
for each row execute function public.enforce_job_inspect_current();

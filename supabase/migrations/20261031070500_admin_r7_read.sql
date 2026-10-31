-- Lee 2026-10-31 approved: read-only R7 diagnostic for authenticated admins.
-- No direct table SELECT grant and no production data mutation.
begin;
do $$
begin
  if to_regprocedure('public.is_admin()') is null
     or to_regclass('public.local_jobs') is null then
    raise exception 'admin R7 read preflight: missing admin guard or jobs table';
  end if;
end $$;

create or replace function public.admin_job_r7_read(p_job_id bigint)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'job_id', j.id,
    'title', j.title,
    'active', j.active,
    'admin_hidden', j.admin_hidden,
    'publish_gate_reason', j.publish_gate_reason,
    'policy_decision', j.policy_decision,
    'ocr_check', j.ocr_check,
    'ocr_text', j.ocr_text,
    'images', j.images,
    'compared_values', jsonb_build_object(
      'company', j.company,
      'salary', j.salary,
      'contact_name', j.contact_name,
      'employer_phone', j.employer_phone,
      'contact_zalo', j.contact_zalo,
      'age_min', j.age_min,
      'age_max', j.age_max
    )
  ) into result
  from public.local_jobs j
  where j.id = p_job_id;
  return result;
end;
$$;
revoke all on function public.admin_job_r7_read(bigint) from public, anon, authenticated, service_role;
grant execute on function public.admin_job_r7_read(bigint) to authenticated;
comment on function public.admin_job_r7_read(bigint) is
  'Admin-only read-only R7 evidence. Requires auth.uid and public.is_admin; never exposes a general local_jobs SELECT.';
commit;

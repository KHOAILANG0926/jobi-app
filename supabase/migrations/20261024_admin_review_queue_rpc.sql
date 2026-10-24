-- Read-only administrator review queue; all writes stay in existing admission workflow.
create or replace function public.admin_job_review_queue()
returns table(job_id bigint, title text, company text, source_name text,
  reason text, queued_at timestamptz, original_text text, description_text text,
  location_text text, active boolean, admin_hidden boolean)
language plpgsql security definer set search_path = pg_catalog, public, job_publication_private
as $$
begin
  if not public.is_admin() then
    raise exception 'administrator required' using errcode='insufficient_privilege';
  end if;
  return query
    select j.id, j.title, j.company, j.source,
      case
        when nullif(trim(coalesce(j.source_text,'')),'') is null then '원문 근거 확인'
        when nullif(trim(coalesce(j.description,'')),'') is null then '업무 내용 확인'
        when nullif(trim(coalesce(j.employer_phone,'')),'') is null
          and nullif(trim(coalesce(j.contact_zalo,'')),'') is null then '연락처 확인'
        else '자동 화면 검증 또는 관리자 검토 대기'
      end as reason,
      q.queued_at, j.source_text, j.description, j.location, j.active, j.admin_hidden
    from job_publication_private.review_queue q
    join public.local_jobs j on j.id=q.job_id
    where j.admin_hidden
    order by q.queued_at asc, j.id asc
    limit 200;
end $$;
revoke all on function public.admin_job_review_queue() from public, anon, authenticated;
grant execute on function public.admin_job_review_queue() to authenticated;

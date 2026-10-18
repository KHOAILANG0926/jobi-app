-- Read-only check after applying the pending migration.
do $$
begin
 if not exists(select 1 from pg_trigger where tgrelid='public.local_jobs'::regclass
    and tgname='trg_zzzz_occupation_publication' and tgenabled='O') then
   raise exception 'Occupation publication trigger missing/disabled';
 end if;
 if exists(select 1 from public.local_jobs where active is true and
    public.job_occupation_publish_reason(occupation_code,occupation_evidence,source_text)<>'ok') then
   raise exception 'Public jobs without original-source occupation evidence';
 end if;
end $$;
select j.id,j.active,j.admin_hidden,j.occupation_code,m.name_vi,
 public.job_occupation_publish_reason(j.occupation_code,j.occupation_evidence,j.source_text) as occupation_review
 from public.local_jobs j left join public.occupation_master m on m.code=j.occupation_code
 where j.active is true or (j.created_at>=date '2026-10-17' and j.admin_hidden=false);

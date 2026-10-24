-- Compare-and-set administrator corrections. Never grants publication authority.
create or replace function public.admin_review_correct_job(
 target_job_id bigint, expected_content_hash text, fields jsonb, correction_reason text
) returns text language plpgsql security definer
set search_path=pg_catalog,public,job_publication_private as $$
declare j public.local_jobs%rowtype; previous_hash text; new_hash text;
begin
 perform public.require_admin();
 if fields is null or jsonb_typeof(fields) <> 'object'
    or fields = '{}'::jsonb then raise exception 'No corrections'; end if;
 if trim(coalesce(correction_reason,'')) = '' then raise exception 'Correction reason is required'; end if;
 if exists(select 1 from jsonb_object_keys(fields) as k(key)
   where k.key <> all(array['title','description','company','salary','location','hours',
     'work_days','work_period','education','preference','age_requirement','gender_requirement',
     'employer_phone','contact_zalo'])) then
   raise exception 'Unapproved correction field';
 end if;
 select * into j from public.local_jobs where id=target_job_id for update;
 if not found then raise exception 'Job not found'; end if;
 previous_hash := job_publication_private.content_fingerprint(j);
 if previous_hash is distinct from expected_content_hash then
   raise exception 'Dữ liệu đã thay đổi. Hãy tải lại trước khi lưu.'
     using errcode='serialization_failure';
 end if;
 update public.local_jobs set
   title=case when fields ? 'title' then fields->>'title' else title end,
   description=case when fields ? 'description' then fields->>'description' else description end,
   company=case when fields ? 'company' then fields->>'company' else company end,
   salary=case when fields ? 'salary' then fields->>'salary' else salary end,
   location=case when fields ? 'location' then fields->>'location' else location end,
   hours=case when fields ? 'hours' then fields->>'hours' else hours end,
   work_days=case when fields ? 'work_days' then fields->>'work_days' else work_days end,
   work_period=case when fields ? 'work_period' then fields->>'work_period' else work_period end,
   education=case when fields ? 'education' then fields->>'education' else education end,
   preference=case when fields ? 'preference' then fields->>'preference' else preference end,
   age_requirement=case when fields ? 'age_requirement' then fields->>'age_requirement' else age_requirement end,
   gender_requirement=case when fields ? 'gender_requirement' then fields->>'gender_requirement' else gender_requirement end,
   employer_phone=case when fields ? 'employer_phone' then fields->>'employer_phone' else employer_phone end,
   contact_zalo=case when fields ? 'contact_zalo' then fields->>'contact_zalo' else contact_zalo end,
   admin_hidden=true
 where id=target_job_id;
 select job_publication_private.content_fingerprint(saved_row) into new_hash from public.local_jobs saved_row where saved_row.id=target_job_id;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,metadata)
 values(auth.uid(),'review_job_corrected','local_job',target_job_id::text,
   jsonb_build_object('reason',correction_reason,'changed_keys',
    (select jsonb_agg(key) from jsonb_object_keys(fields) as key),
    'previous_hash',previous_hash,'current_hash',new_hash));
 return new_hash;
end $$;
revoke all on function public.admin_review_correct_job(bigint,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_review_correct_job(bigint,text,jsonb,text) to authenticated;

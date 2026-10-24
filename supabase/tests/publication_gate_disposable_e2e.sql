-- Disposable PostgreSQL fixture; never executed on production.
create table public.local_jobs (
 id bigint generated always as identity primary key,
 title text, company text, description text, salary text, location text,
 hours text, work_days text, work_period text, education text, preference text,
 gender_requirement text, age_requirement text, age_min integer, age_max integer,
 occupation_code text, occupation_evidence text, employer_phone text, contact_zalo text,
 source_text text, source_url text, images jsonb, lat double precision, lng double precision,
 recruitment_regions text[], work_schedule text, weekend_work boolean, shift_type text,
 job_duration text, employment_type text, salary_note text, benefit_tags text[],
 num_hires text, application_deadline text, required_documents text, language_requirement text,
 active boolean default true, admin_hidden boolean default false
);
create table public.job_work_locations (
 id bigint generated always as identity primary key,
 job_id bigint references public.local_jobs(id) on delete cascade,
 raw_address text, normalized_address text, lat double precision, lng double precision,
 sort_order integer, address_accuracy text, coordinate_accuracy text,
 location_verified boolean, geocode_status text, industrial_park text, shuttle_route text
);
\i supabase/migrations/20261024_mandatory_publication_attestation.sql

insert into public.local_jobs(title,company,description,salary,location,employer_phone,active,admin_hidden)
values ('Fixture','Employer','Some relevant work','10 million','Bắc Ninh','0337152446',true,false);

do $$
begin
 if not exists (select 1 from public.local_jobs where id=1 and admin_hidden) then
   raise exception 'FAIL: new job immediately public';
 end if;
 if not exists (select 1 from job_publication_private.review_queue where job_id=1 and auto_release) then
   raise exception 'FAIL: new job not queued';
 end if;
 begin
   update public.local_jobs set admin_hidden=false where id=1;
   raise exception 'FAIL: unpublished job bypassed approval';
 exception when check_violation then
   if sqlerrm not like 'publication_guard:%' then raise; end if;
 end;
end $$;

insert into job_publication_private.approvals(job_id,content_hash,evidence)
select 1,job_publication_private.content_fingerprint(j),
 '{"result":"pass","browser_test":"staging test","source_review":"staging test"}'::jsonb
from public.local_jobs j where id=1;
update public.local_jobs set admin_hidden=false where id=1;
do $$
begin
 if not exists (select 1 from public.local_jobs where id=1 and not admin_hidden) then
   raise exception 'FAIL: certified exact data could not publish';
 end if;
end $$;

update public.local_jobs set company='Changed employer' where id=1;
do $$
begin
 if not exists (select 1 from public.local_jobs where id=1 and admin_hidden) then
   raise exception 'FAIL: content change left an unreviewed job public';
 end if;
 begin
   update public.local_jobs set admin_hidden=false where id=1;
   raise exception 'FAIL: stale proof reused';
 exception when check_violation then
   if sqlerrm not like 'publication_guard:%' then raise; end if;
 end;
end $$;

-- Certify updated content and test workplace changes invalidate it too.
insert into job_publication_private.approvals(job_id,content_hash,evidence)
select 1,job_publication_private.content_fingerprint(j),
 '{"result":"pass","browser_test":"staging test","source_review":"staging test"}'::jsonb
from public.local_jobs j where id=1
on conflict(job_id) do update set content_hash=excluded.content_hash, evidence=excluded.evidence;
update public.local_jobs set admin_hidden=false where id=1;
insert into public.job_work_locations(job_id,raw_address,lat,lng,sort_order)
values(1,'Updated workplace',21.1,106.1,0);
do $$
begin
 if not exists (select 1 from public.local_jobs where id=1 and admin_hidden) then
   raise exception 'FAIL: new work-location did not invalidate approval';
 end if;
 if not exists (select 1 from job_publication_private.review_queue
   where job_id=1 and auto_release and content_hash =
     (select job_publication_private.content_fingerprint(j) from public.local_jobs j where id=1)) then
   raise exception 'FAIL: location update missing current review queue';
 end if;
end $$;
select 'GATE_DB_TEST_PASS' as result;

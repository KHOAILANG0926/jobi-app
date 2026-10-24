-- Disposable PostgreSQL fixture; never executed on production.
do $role_setup$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $role_setup$;
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

-- 100-job load test: all new submissions enter hidden queue; no silent public rows.
insert into public.local_jobs(title,company,description,salary,location,employer_phone,active,admin_hidden)
select 'Job '||n,'Company '||n,'Realistic duties '||n,'10 million','Bắc Ninh','0337152446',true,false
from generate_series(2,101) n;
do $batch$
declare initial_hidden int; pending int;
begin
 select count(*) into initial_hidden from public.local_jobs where id between 2 and 101 and admin_hidden;
 select count(*) into pending from job_publication_private.review_queue where job_id between 2 and 101;
 if initial_hidden <> 100 or pending <> 100 then raise exception '100 job isolation failure: hidden %, pending %',initial_hidden,pending; end if;
end $batch$;
-- Approve half and keep half hidden. Test that a stale snapshot cannot be reused.
insert into job_publication_private.approvals(job_id,content_hash,evidence)
select j.id,job_publication_private.content_fingerprint(j),
 '{"result":"pass","browser_test":"staging 100-job gate fixture","source_review":"staging 100-job gate fixture"}'::jsonb
from public.local_jobs j where j.id between 2 and 51;
update public.local_jobs set admin_hidden=false where id between 2 and 51;
do $batch$
declare public_count int; hidden_count int;
begin
 select count(*) into public_count from public.local_jobs where id between 2 and 101 and active and not admin_hidden;
 select count(*) into hidden_count from public.local_jobs where id between 2 and 101 and admin_hidden;
 if public_count <> 50 or hidden_count <> 50 then raise exception '100-job mixed state invalid: public %, hidden %',public_count,hidden_count; end if;
 begin
   update public.local_jobs set admin_hidden=false where id=52;
   raise exception 'Unapproved item published';
 exception when check_violation then
   if sqlerrm not like 'publication_guard:%' then raise; end if;
 end;
end $batch$;
select '100_JOB_GATE_TEST_PASS' as result;

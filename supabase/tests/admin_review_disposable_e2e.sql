\set ON_ERROR_STOP on
\i supabase/tests/publication_gate_disposable_e2e.sql
alter table public.local_jobs add column source text;
alter table public.local_jobs add column origin text;
create schema auth;
create function auth.uid() returns uuid language sql stable as
'select nullif(current_setting(''app.test_admin'',true),'''')::uuid';
create function public.is_admin() returns boolean language sql stable as
'select auth.uid() is not null';
create function public.require_admin() returns uuid language plpgsql stable as $x$
begin
 if auth.uid() is null then raise exception 'admin access required' using errcode='42501'; end if;
 return auth.uid();
end $x$;
create table public.admin_audit_logs(
 id bigint generated always as identity primary key,
 admin_user_id uuid not null, action text not null, target_type text not null,
 target_id text not null, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
\i supabase/migrations/20261024_admin_review_queue_rpc.sql
\i supabase/migrations/20261024_admin_review_safe_corrections.sql
\i supabase/migrations/20261024_admin_access_audit.sql
do $$
declare before_hash text; after_hash text;
begin
 select job_publication_private.content_fingerprint(j) into before_hash
 from public.local_jobs j where id=1;
 begin
   perform public.admin_review_correct_job(1,before_hash,
     '{"description":"safe correction"}'::jsonb,'explanation');
   raise exception 'Unauthorized administrator bypass';
 exception when insufficient_privilege then null;
 end;
 perform set_config('app.test_admin','11111111-1111-4111-8111-111111111111',true);
 select job_publication_private.content_fingerprint(j) into before_hash
 from public.local_jobs j where id=1;
 after_hash := public.admin_review_correct_job(1,before_hash,
   '{"description":"checked and corrected"}'::jsonb,'source fact verified');
 if after_hash = before_hash then raise exception 'Revision did not change'; end if;
 if not exists(select 1 from public.local_jobs where id=1 and admin_hidden) then
   raise exception 'Correction exposed unverified public job';
 end if;
 if not exists(select 1 from public.admin_audit_logs
               where admin_user_id='11111111-1111-4111-8111-111111111111'
                 and action='review_job_corrected'
                 and metadata->>'reason'='source fact verified') then
   raise exception 'Audit actor or reason not captured';
 end if;
 begin
   perform public.admin_review_correct_job(1,before_hash,
     '{"description":"overwrite from stale editor"}'::jsonb,'conflicting editor');
   raise exception 'Concurrent edit incorrectly accepted';
 exception when serialization_failure then null;
 end;
 begin
   perform public.admin_review_correct_job(1,after_hash,
     '{"admin_hidden":false}'::jsonb,'attempt to bypass release');
   raise exception 'Privileged field override accepted';
 exception when raise_exception then
   if sqlerrm not like 'Unapproved correction field%' then raise; end if;
 end;
 if (select count(*) from public.admin_job_review_queue()) < 1 then
   raise exception 'Admin review queue inaccessible';
 end if;
end $$;
select 'ADMIN_SECURITY_TEST_PASS' as result;

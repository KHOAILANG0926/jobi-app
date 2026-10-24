-- Admission control for all newly submitted local jobs.
-- Installs beside R1-R8 rather than replacing their triggers.
-- Existing public jobs are untouched until their public-facing content changes.
create schema if not exists job_publication_private;
revoke all on schema job_publication_private from public, anon, authenticated;

create table if not exists job_publication_private.approvals (
  job_id bigint primary key references public.local_jobs(id) on delete cascade,
  content_hash text not null,
  verified_at timestamptz not null default now(),
  evidence jsonb not null,
  constraint evidence_shape check (
    jsonb_typeof(evidence) = 'object'
    and evidence->>'result' = 'pass'
    and evidence ? 'browser_test'
    and evidence ? 'source_review'
  )
);
revoke all on job_publication_private.approvals from public, anon, authenticated, service_role;

create or replace function job_publication_private.content_fingerprint(j public.local_jobs)
returns text language sql stable as $
  select md5(jsonb_build_object(
    'title', j.title, 'company', j.company, 'description', j.description,
    'salary', j.salary, 'location', j.location, 'hours', j.hours,
    'work_days', j.work_days, 'work_period', j.work_period,
    'education', j.education, 'preference', j.preference,
    'gender_requirement', j.gender_requirement,
    'age_requirement', j.age_requirement, 'age_min', j.age_min,
    'age_max', j.age_max, 'occupation_code', j.occupation_code,
    'occupation_evidence', j.occupation_evidence,
    'employer_phone', j.employer_phone, 'contact_zalo', j.contact_zalo,
    'source_text', j.source_text, 'source_url', j.source_url,
    'images', j.images,
    'map_fields', jsonb_build_object('lat', j.lat, 'lng', j.lng, 'recruitment_regions',j.recruitment_regions),
    'work_settings', jsonb_build_object('work_schedule',j.work_schedule,'weekend_work',j.weekend_work,'shift_type',j.shift_type,'job_duration',j.job_duration,'employment_type',j.employment_type),
    'other_details', jsonb_build_object('salary_note',j.salary_note,'benefit_tags',j.benefit_tags,'num_hires',j.num_hires,'application_deadline',j.application_deadline,'required_documents',j.required_documents,'language_requirement',j.language_requirement),
    'locations', coalesce((select jsonb_agg(jsonb_build_object(
      'raw_address',w.raw_address,'normalized_address',w.normalized_address,'lat',w.lat,'lng',w.lng,
      'sort_order',w.sort_order,'address_accuracy',w.address_accuracy,'coordinate_accuracy',w.coordinate_accuracy,
      'location_verified',w.location_verified,'geocode_status',w.geocode_status,
      'industrial_park',w.industrial_park,'shuttle_route',w.shuttle_route) order by w.sort_order,w.id)
      from public.job_work_locations w where w.job_id=j.id),'[]'::jsonb)
  )::text);
$$;
revoke all on function job_publication_private.content_fingerprint(public.local_jobs) from public, anon, authenticated;

create or replace function job_publication_private.guard_publication()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, job_publication_private as $$
declare
  is_public boolean;
  was_public boolean;
  content_changed boolean;
  approved boolean;
begin
  is_public := coalesce(new.active,false) and not coalesce(new.admin_hidden,false);
  if tg_op = 'INSERT' then
    -- Every input channel, including direct SQL/service role, starts unpublished.
    new.admin_hidden := true;
    return new;
  end if;
  was_public := coalesce(old.active,false) and not coalesce(old.admin_hidden,false);
  content_changed := job_publication_private.content_fingerprint(new)
                     is distinct from job_publication_private.content_fingerprint(old);

  if content_changed then
    -- A content edit is saved, but always remains hidden until separately re-reviewed.
    new.admin_hidden := true;
    return new;
  end if;

  if is_public and not was_public then
    -- Never treat a marker or caller-provided flag as proof.
    select exists (
      select 1 from job_publication_private.approvals a
      where a.job_id = new.id
        and a.content_hash = job_publication_private.content_fingerprint(new)
        and a.evidence->>'result' = 'pass'
    ) into approved;
    if not approved then
      raise exception 'publication_guard: job % has no verified approval for its content',new.id
        using errcode = 'check_violation';
    end if;
    -- A valid attestation permits explicit publication after R1-R8 processing.
    new.admin_hidden := false;
  end if;
  return new;
end $$;
revoke all on function job_publication_private.guard_publication() from public, anon, authenticated;

drop trigger if exists trg_zzzzz_verified_publication on public.local_jobs;
create trigger trg_zzzzz_verified_publication
before insert or update on public.local_jobs
for each row execute function job_publication_private.guard_publication();

comment on table job_publication_private.approvals is
  'Owner-controlled evidence of source review and rendered-detail browser acceptance; no app or crawler grants.';

-- Queue only new submissions and changes to previously public submissions.
-- A manually moderated/hidden legacy record is never republished from this queue.
create table if not exists job_publication_private.review_queue (
  job_id bigint primary key references public.local_jobs(id) on delete cascade,
  content_hash text not null,
  auto_release boolean not null default false,
  queued_at timestamptz not null default now()
);
revoke all on job_publication_private.review_queue from public, anon, authenticated, service_role;

create or replace function job_publication_private.queue_content_review()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, job_publication_private as $$
declare h text;
begin
  h := job_publication_private.content_fingerprint(new);
  if tg_op = 'INSERT' then
    insert into job_publication_private.review_queue (job_id, content_hash, auto_release)
    values (new.id, h, true)
    on conflict (job_id) do update
      set content_hash = excluded.content_hash, queued_at = now();
  elsif h is distinct from job_publication_private.content_fingerprint(old) then
    insert into job_publication_private.review_queue (job_id, content_hash, auto_release)
    values (new.id, h, (coalesce(old.active,false) and not coalesce(old.admin_hidden,false)))
    on conflict (job_id) do update
      set content_hash = excluded.content_hash, queued_at = now();
  end if;
  return null;
end $$;
revoke all on function job_publication_private.queue_content_review() from public, anon, authenticated, service_role;
drop trigger if exists trg_zzzzz_queue_content_review on public.local_jobs;
create trigger trg_zzzzz_queue_content_review
after insert or update on public.local_jobs
for each row execute function job_publication_private.queue_content_review();

-- Map changes are substantive content changes too. A verifier must review
-- the exact workplace records seen in the browser, not just local_jobs values.
create or replace function job_publication_private.on_work_location_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, job_publication_private as $$
declare affected_id bigint; new_id bigint; old_id bigint; row_job public.local_jobs%rowtype; h text; public_before boolean;
begin
  if tg_op <> 'DELETE' then new_id := new.job_id; end if;
  if tg_op <> 'INSERT' then old_id := old.job_id; end if;
  for affected_id in select distinct value from unnest(array[new_id,old_id]) as t(value) where value is not null loop
    select * into row_job from public.local_jobs where id=affected_id for update;
    if not found then continue; end if;
    public_before := coalesce(row_job.active,false) and not coalesce(row_job.admin_hidden,false);
    h := job_publication_private.content_fingerprint(row_job);
    insert into job_publication_private.review_queue (job_id,content_hash,auto_release)
      values (affected_id,h,public_before)
    on conflict(job_id) do update set
      content_hash=excluded.content_hash, queued_at=now(),
      auto_release=job_publication_private.review_queue.auto_release or excluded.auto_release;
    if public_before then
      update public.local_jobs set admin_hidden=true where id=affected_id;
    end if;
  end loop;
  return null;
end $$;
revoke all on function job_publication_private.on_work_location_change() from public, anon, authenticated, service_role;
drop trigger if exists trg_verified_publication_work_location on public.job_work_locations;
create trigger trg_verified_publication_work_location
after insert or update or delete on public.job_work_locations
for each row execute function job_publication_private.on_work_location_change();

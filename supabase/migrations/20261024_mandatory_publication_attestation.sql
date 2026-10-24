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
returns text language sql immutable as $$
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
    'images', j.images
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
    -- Never keep a previously reviewed posting visible after its substantive content changes.
    new.admin_hidden := true;
  end if;

  if is_public and (content_changed or not was_public) then
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
    if not content_changed then new.admin_hidden := false; end if;
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

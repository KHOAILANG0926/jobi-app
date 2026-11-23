-- 시험 DB 준비(폐기용): 운영 입구·중복 판정 함수와 같은 줄을 가진 대역. migration이 고치는 줄이 실제 본문에 있을 때만 적용되므로
-- 여기서는 그 두 줄과 6개 자리 find_existing 본문(운영 20261029010000 그대로)을 갖춘다. 진짜 운영 본문 대상 시험은 branch_job_identity.pglite.test.mjs.
create schema if not exists ingest_private;
create schema if not exists dedupe_private;
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end$$;
alter table public.local_jobs add column if not exists source_url text;
alter table public.local_jobs add column if not exists source_text text;
alter table public.local_jobs add column if not exists employer_phone text;
alter table public.local_jobs add column if not exists active boolean not null default true;
alter table public.local_jobs add column if not exists admin_hidden boolean not null default false;
alter table public.job_work_locations add column if not exists normalized_address text;
create table if not exists public.job_ingest_raw (id bigint generated always as identity primary key, source_url text, content_hash text not null, job_id bigint references public.local_jobs(id));
create or replace function public.job_phone_digits(x text) returns text language sql immutable as $$ select nullif(regexp_replace(coalesce(x,''), '[^0-9]', '', 'g'), '') $$;
create function ingest_private.find_existing(p_raw bigint, p_hash text, p_source_url text, p_phone text, p_company text, p_source_text text)
returns bigint language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(
    (select r.job_id from public.job_ingest_raw r join public.local_jobs j on j.id = r.job_id
      where r.id <> p_raw and (r.content_hash = p_hash or (nullif(p_source_url, '') is not null and r.source_url = p_source_url))
      order by r.id limit 1),
    (select j.id from public.local_jobs j where nullif(p_source_url, '') is not null and j.source_url = p_source_url order by j.id limit 1),
    (select j.id from public.local_jobs j
      where nullif(trim(p_source_text), '') is not null and j.source_text is not null and md5(j.source_text) = md5(p_source_text)
        and coalesce(public.job_phone_digits(j.employer_phone), '') = coalesce(public.job_phone_digits(p_phone), '')
        and lower(coalesce(j.company, '')) = lower(coalesce(p_company, ''))
      order by j.id limit 1));
$$;
create or replace function public.ingest_job(p jsonb) returns bigint language plpgsql as $f$
declare hash text; raw_id bigint; target bigint;
begin
  hash := md5(coalesce(public.job_phone_digits(p->>'employer_phone'), '') || '|' || lower(coalesce(p->>'company', '')) || '|' || md5(p->>'source_text'));
  target := ingest_private.find_existing(raw_id, hash, p->>'source_url', p->>'employer_phone', p->>'company', p->>'source_text');
  return target;
end $f$;
create or replace function dedupe_private.verdict(p_job bigint, out verdict text, out other bigint, out reason text) language plpgsql stable as $f$
declare o record;
begin
  verdict := 'new';
  for o in
    select j.id from public.local_jobs j
     where j.id < p_job and j.active and not coalesce(j.admin_hidden, false)
     order by j.id
  loop verdict := 'duplicate'; other := o.id; reason := 'stub'; return; end loop;
end $f$;

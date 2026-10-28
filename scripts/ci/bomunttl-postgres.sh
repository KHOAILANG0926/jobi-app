#!/usr/bin/env bash
# Local disposable container only; no operational connection or credentials.
set -euo pipefail
docker() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
bomunttl_container="bomunttl-regression-${RANDOM}-${RANDOM}"
bomunttl_log=$(mktemp)
trap 'docker rm -f "$bomunttl_container" >/dev/null 2>&1 || true; rm -f "$bomunttl_log"' EXIT
docker run -d --name "$bomunttl_container" -e POSTGRES_HOST_AUTH_METHOD=trust postgis/postgis:17-3.5 >/dev/null
for attempt in $(seq 1 30); do
 if docker exec "$bomunttl_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$bomunttl_container" createdb -h 127.0.0.1 -U postgres bomunttl_test
psql_local() { docker exec -i "$bomunttl_container" psql -X -h 127.0.0.1 -U postgres -d bomunttl_test -v ON_ERROR_STOP=1 "$@"; }
fixture=supabase/pending/location-single-source-20261026/production
for f in 05-production-schema.sql 06-test-environment.sql 07-production-functions.sql 07-queue-functions.sql; do
 psql_local < "$fixture/$f" > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log"; exit 1; }
done
psql_local <<'SQL' >/dev/null
alter table public.job_posting_rules add column incidents text;
create or replace function public.is_admin() returns boolean language sql as $$select false$$;
SQL
for f in \
 20261012153000_job_posting_policy_db_enforcement.sql \
 20261013100000_job_posting_rules.sql \
 20261015100000_occupation_master.sql \
 20261015100100_occupation_master_seed.sql \
 20261015120000_local_jobs_occupation_r8.sql \
 20261017070517_occupation_publication_gate.sql \
 20261018090000_occupation_code_any_level.sql \
 20261026231445_location_single_source.sql \
 20261028034009_lee_verified_sources.sql \
 20261028034036_register_bomunttl.sql; do
 psql_local -1 < "supabase/migrations/$f" > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log"; exit 1; }
done
psql_local -1 < supabase/migrations/20261028034036_register_bomunttl.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log"; exit 1; }
psql_local < supabase/tests/bomunttl_production_check.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log"; exit 1; }
psql_local <<'SQL' >/dev/null
do $$ begin
 if not exists(select 1 from public.local_jobs j join public.job_work_locations w on w.job_id=j.id
  where j.company='Bomunttl' and j.active and w.lat is null and w.lng is null
  and w.point_kind='unresolved' and w.location_verified=false and w.geocode_status='pending') then
  raise exception 'canonical unresolved writer/administrator review invariant failed';
 end if;
end $$;
SQL
echo 'PASS: actual PostgreSQL rules + single registration + repeat safety + canonical unresolved writer + production check'
# Preserve the original registration/unresolved checks above, then verify the
# newly approved approximation policy on the same actual PostgreSQL fixture.
for f in 20261027042533_location_company_index_execute.sql 20261028050507_administrative_area_fallback.sql;do
 psql_local -1 < "supabase/migrations/$f" > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
done
for f in administrative_area_fallback_production_check.sql location_single_source_production_check.sql;do
 psql_local < "supabase/tests/$f" > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
done
echo 'PASS: same PostgreSQL public fixtures gain canonical administrative pins, retain review flags and source/cache integrity'

psql_local -1 < supabase/migrations/20261028051147_multi_role_presentation_rules.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
psql_local < supabase/tests/multi_role_presentation_production_check.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
echo 'PASS: public fixture retains multi-role/no-post-time rules and approved approximate pin policy'

# Lee 2026-10-28: canonical area pin releases/prevents the "location not found" hold; multi-role jobs get no automatic global meal flag.
psql_local <<'SQL' >/dev/null
create table if not exists public.map_r1_unlocated (job_id bigint primary key references public.local_jobs(id) on delete cascade,
 since timestamptz not null default now(), last_checked timestamptz not null default now(), prev_active boolean not null default false, reason text not null default 'our_miss');
SQL
psql_local <<'SQL' > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
do $$ declare jid bigint; begin
 select j.id into strict jid from public.local_jobs j where j.company='Bomunttl';
 if not exists(select 1 from public.job_work_locations w where w.job_id=jid and w.point_kind='area' and w.lat is not null) then
  raise exception 'fixture: Bomunttl canonical area pin expected before hold test';
 end if;
 -- Reproduce the production state: held by the old resolver while it was public.
 insert into public.map_r1_unlocated(job_id,prev_active,reason) values(jid,true,'our_miss');
 update public.local_jobs set active=false where local_jobs.id=jid;
end $$;
SQL
psql_local -1 < supabase/migrations/20261028080000_area_pin_releases_unlocated_hold.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
psql_local <<'SQL' > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
do $$ declare jid bigint; begin
 select j.id into strict jid from public.local_jobs j where j.company='Bomunttl';
 if exists(select 1 from public.map_r1_unlocated u where u.job_id=jid) or not (select active from public.local_jobs where local_jobs.id=jid) then
  raise exception 'existing hold on canonical area pin was not released';
 end if;
 perform public.map_r1_mark_unlocated(jid,'our_miss');
 if exists(select 1 from public.map_r1_unlocated u where u.job_id=jid) or not (select active from public.local_jobs where local_jobs.id=jid) then
  raise exception 'canonical area pin was held as unlocated again';
 end if;
 update public.local_jobs set admin_hidden=true where local_jobs.id=jid;
 insert into public.map_r1_unlocated(job_id,prev_active) values(jid,true);
 update public.local_jobs set active=false where local_jobs.id=jid;
 perform public.map_r1_mark_located(jid);
 if (select active from public.local_jobs where local_jobs.id=jid) then raise exception 'admin_hidden job was republished'; end if;
 update public.local_jobs set admin_hidden=false,active=true where local_jobs.id=jid;
end $$;
SQL
psql_local < supabase/tests/area_pin_hold_meal_production_check.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
psql_local < supabase/tests/bomunttl_production_check.sql > "$bomunttl_log" 2>&1 || { cat "$bomunttl_log";exit 1; }
# The rule check must fail on an automatic global meal flag and name the job and values.
psql_local <<'SQL' >/dev/null
update public.local_jobs set meal_provided=true,
 ocr_check=coalesce(ocr_check,'{}'::jsonb)||'{"benefits_ai":{"found":[{"code":"meal_provided","evidence":"Bao ăn 2 bữa"}]}}'::jsonb
where company='Bomunttl';
SQL
if psql_local < supabase/tests/area_pin_hold_meal_production_check.sql > "$bomunttl_log" 2>&1; then
 cat "$bomunttl_log"; echo '::error::automatic multi-role meal flag passed the production check'; exit 1
fi
grep -qE 'multi-role meal check: automatic global meal flag — #[0-9]+: meal_provided 운영=true 기대=null \(AI 자동, 직무 2개\)' "$bomunttl_log" || { cat "$bomunttl_log"; exit 1; }
echo 'PASS: canonical area pin releases/prevents unlocated hold (admin_hidden kept) and multi-role automatic meal flag is reported'

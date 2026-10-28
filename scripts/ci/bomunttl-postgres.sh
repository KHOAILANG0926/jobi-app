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

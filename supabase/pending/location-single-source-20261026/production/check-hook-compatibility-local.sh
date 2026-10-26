#!/usr/bin/env bash
# Targeted check-only test: fresh local PostgreSQL, no remote connection accepted.
set -euo pipefail
docker() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
location_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
location_repo=$(cd "$location_dir/../../../.." && pwd)
location_container="location-hook-check-${RANDOM}-${RANDOM}"
location_temp=$(mktemp -d)
trap 'docker rm -f "$location_container" >/dev/null 2>&1 || true;rm -rf "$location_temp"' EXIT
docker run -d --name "$location_container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in $(seq 1 30);do if docker exec "$location_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi;sleep 1;done
psql_local() { docker exec -i "$location_container" psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
psql_local <<'SQL' >/dev/null
create role anon nologin;create role authenticated nologin;create role service_role nologin;
create table public.local_jobs(id bigint,origin text);
create table public.job_work_locations(job_id bigint,raw_address text,point_kind text);
create schema cron;create table cron.job(jobname text,active boolean);
insert into cron.job values('map-r1-retry-pending',true);
create schema vault;create table vault.secrets(name text);
insert into vault.secrets values('map_r1_hook_token');
create function public.map_r1_hook_token_ok(text) returns boolean language sql as $$select false$$;
revoke all on function public.map_r1_hook_token_ok(text) from public,anon,authenticated;
create function public.map_r1_on_job_saved() returns trigger language plpgsql as $$begin return new;end$$;
create trigger trg_map_r1_job_saved after insert on public.local_jobs for each row execute function public.map_r1_on_job_saved();
create trigger trg_map_r1_work_location_saved after insert on public.job_work_locations for each row execute function public.map_r1_on_job_saved();
SQL
run_check() { psql_local < "$location_repo/supabase/tests/map_r1_hook_production_check.sql"; }
expect_failure() {
 local expected=$1
 if run_check > "$location_temp/failure.log" 2>&1;then echo "FAIL: expected $expected";exit 1;fi
 rg -q "$expected" "$location_temp/failure.log" || { cat "$location_temp/failure.log";exit 1; }
}
run_check >/dev/null
psql_local -c 'drop trigger trg_map_r1_work_location_saved on public.job_work_locations' >/dev/null
expect_failure 'trg_map_r1_work_location_saved missing'
echo 'PASS: legacy hook required before canonical migration'
psql_local <<'SQL' >/dev/null
create schema location_private;
create function location_private.write_location(bigint,text,jsonb) returns bigint language sql as $$select null::bigint$$;
SQL
# Test the exact authorized adapter body from the pinned migration, not a copied
# approximation; no migration contents or database mutation path are changed.
node --input-type=module - "$location_repo/supabase/migrations/20261026231445_location_single_source.sql" "$location_temp/adapter.sql" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const text=readFileSync(process.argv[2],'utf8');
const start=text.indexOf('create or replace function public.replace_job_work_locations(');
const end=text.indexOf('end$$;',start);
if(start<0||end<0)throw new Error('Actual batch adapter not found');
writeFileSync(process.argv[3],text.slice(start,end+7));
JS
psql_local < "$location_temp/adapter.sql" >/dev/null
psql_local -c 'revoke all on function public.replace_job_work_locations(bigint,jsonb) from public,anon,authenticated;grant execute on function public.replace_job_work_locations(bigint,jsonb) to service_role' >/dev/null
run_check >/dev/null
echo 'PASS: canonical retained parent hook and actual authorized batch requester accepted'
psql_local -c 'create trigger trg_map_r1_work_location_saved after insert on public.job_work_locations for each row execute function public.map_r1_on_job_saved()' >/dev/null
expect_failure 'unresolved-skeleton request hook'
psql_local -c 'drop trigger trg_map_r1_work_location_saved on public.job_work_locations;grant execute on function public.replace_job_work_locations(bigint,jsonb) to anon' >/dev/null
expect_failure 'authorized batch requester missing/unsafe'
psql_local -c 'revoke execute on function public.replace_job_work_locations(bigint,jsonb) from anon;grant execute on function public.map_r1_hook_token_ok(text) to anon' >/dev/null
expect_failure 'anon can check hook token'
echo 'PASS: skeleton hook, unsafe adapter privilege and token exposure rejected'

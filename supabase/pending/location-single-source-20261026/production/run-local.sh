#!/usr/bin/env bash
# Disposable local Docker socket only. Never accepts a remote database URL.
set -euo pipefail
docker() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
location_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
location_repo=$(cd "$location_dir/../../../.." && pwd)
location_migration=${1:-supabase/migrations/20261026231445_location_single_source.sql}
[[ "$location_migration" = /* ]] || location_migration="$location_repo/$location_migration"
[[ "$location_migration" == "$location_repo"/supabase/migrations/*.sql && -f "$location_migration" ]] || { echo 'Expected an existing repository migration SQL file' >&2;exit 1; }
location_container="canonical-location-${RANDOM}-${RANDOM}"
location_logs=$(mktemp -d)
trap 'docker rm -f "$location_container" >/dev/null 2>&1 || true; rm -rf "$location_logs"' EXIT
docker run -d --name "$location_container" -e POSTGRES_HOST_AUTH_METHOD=trust postgis/postgis:17-3.5 >/dev/null
for attempt in $(seq 1 30);do if docker exec "$location_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi;sleep 1;done
psql_local() { docker exec -i "$location_container" psql -X -U postgres -d "$1" -v ON_ERROR_STOP=1 "${@:2}"; }
docker exec "$location_container" createdb -U postgres canonical_baseline
for script in 05-production-schema.sql 06-test-environment.sql 07-production-functions.sql 07-queue-functions.sql 08-legacy-fixture.sql;do
 psql_local canonical_baseline < "$location_dir/$script" > "$location_logs/$script.log"
done
# Match managed Supabase: migration postgres has CREATEROLE/CREATEDB but is
# not superuser. Extensions/schema are already installed by the bootstrap.
psql_local canonical_baseline <<'SQL' >/dev/null
create role location_migration_operator nologin createrole createdb bypassrls;
grant location_migration_operator to postgres;
grant usage,create on schema public to location_migration_operator with grant option;
alter schema auth owner to location_migration_operator;
alter schema vault owner to location_migration_operator;
alter schema net owner to location_migration_operator;
do $$declare r record;begin
 for r in select c.oid::regclass relation from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','auth','net','vault') and c.relkind='r' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') loop
 execute format('alter table %s owner to location_migration_operator',r.relation);end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','auth','net','vault') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
 execute format('alter function %s owner to location_migration_operator',r.signature);end loop;
end$$;
SQL
psql_apply() { psql_local "$1" -c "grant create on database \"$1\" to location_migration_operator" -c 'set role location_migration_operator' -1 -f -; }
# Rollback before DDL: missing original evidence.
docker exec "$location_container" createdb -U postgres -T canonical_baseline missing_evidence
psql_local missing_evidence -c "update public.job_work_locations set geocode_source=null where lat is not null" >/dev/null
if psql_apply missing_evidence < "$location_migration" > "$location_logs/missing.log" 2>&1;then echo 'FAIL missing-evidence rollback';exit 1;fi
grep -E -q 'Missing legacy source evidence' "$location_logs/missing.log"
[ "$(psql_local missing_evidence -Atc "select count(*) from pg_namespace where nspname='location_private'")" = 0 ]
# Rollback conflicting human evidence, including no partial role/schema creation.
docker exec "$location_container" createdb -U postgres -T canonical_baseline conflicting_evidence
psql_local conflicting_evidence <<'SQL' >/dev/null
insert into public.local_jobs(title,company,location,origin,active,admin_hidden) select title,company,location,origin,false,true from public.local_jobs where company='Legacy human' returning id as duplicate_job \gset
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence,status,reviewed_by,reviewed_at)
 select :duplicate_job,company_snapshot,address_snapshot,lat+0.1,lng,place_precision,source,'Conflicting timestamp evidence',status,reviewed_by,reviewed_at from public.job_location_candidates where evidence='Original human evidence';
SQL
if psql_apply conflicting_evidence < "$location_migration" > "$location_logs/conflict.log" 2>&1;then echo 'FAIL conflict rollback';exit 1;fi
grep -E -q 'Conflicting simultaneous human evidence' "$location_logs/conflict.log"
[ "$(psql_local conflicting_evidence -Atc "select count(*) from pg_roles where rolname='location_writer'")" = 0 ]
# Failure after schema creation proves transaction DDL/data rollback too.
docker exec "$location_container" createdb -U postgres -T canonical_baseline late_evidence_failure
psql_local late_evidence_failure -c "update public.map_r1_location_jobs set result=result-'checkedAt' where state='done'" >/dev/null
if psql_apply late_evidence_failure < "$location_migration" > "$location_logs/late.log" 2>&1;then echo 'FAIL late rollback';exit 1;fi
grep -E -q 'cache import lacks evidence' "$location_logs/late.log"
[ "$(psql_local late_evidence_failure -Atc "select count(*) from pg_namespace where nspname='location_private'")" = 0 ]
[ "$(psql_local late_evidence_failure -Atc "select count(*) from pg_roles where rolname='location_writer'")" = 0 ]
echo 'PASS: missing/conflicting/late evidence failures roll back all DDL and source/cache writes'
docker exec "$location_container" createdb -U postgres -T canonical_baseline canonical_integration
psql_local canonical_integration < "$location_dir/00-preview.sql" > "$location_logs/preview.log"
if ! psql_apply canonical_integration < "$location_migration" > "$location_logs/apply.log" 2>&1;then cat "$location_logs/apply.log";exit 1;fi
for script in 21-import-assertions.sql 20-integration-tests.sql;do
 if ! psql_local canonical_integration < "$location_dir/$script" > "$location_logs/$script.log" 2>&1;then cat "$location_logs/$script.log";exit 1;fi
 grep -E 'PASS:' "$location_logs/$script.log"
done
# Concurrent cases supplied by the same generated fixtures, never production IDs.
source "$location_dir/30-concurrency.sh"
psql_local canonical_integration < "$location_repo/supabase/tests/location_single_source_production_check.sql"
echo 'PASS: canonical production-check assertions on final local fixture'
echo 'PASS: complete disposable canonical location integration'

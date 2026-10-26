#!/usr/bin/env bash
# Only creates a disposable local container. No production URL or secret is accepted.
set -euo pipefail
docker() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
location_script_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
location_container="location-core-dryrun-${RANDOM}-${RANDOM}"
trap 'docker rm -f "$location_container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$location_container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$location_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$location_container" createdb -U postgres location_single_source_dryrun
for script in 05-test-bootstrap.sql 10-core-draft.sql 15-rule-rows-draft.sql 20-core-tests.sql; do
  echo "Running $script"
  docker exec -i "$location_container" psql -X -U postgres -d location_single_source_dryrun -v ON_ERROR_STOP=1 < "$location_script_root/$script"
done
# Verify the review draft refuses any non-test database before executing DDL.
docker exec "$location_container" createdb -U postgres location_wrong_db
location_guard_log=$(mktemp)
if docker exec -i "$location_container" psql -X -U postgres -d location_wrong_db -v ON_ERROR_STOP=1 < "$location_script_root/10-core-draft.sql" > "$location_guard_log" 2>&1; then
  rm -f "$location_guard_log"
  echo 'FAIL: review draft executed outside its disposable database' >&2
  exit 1
fi
rg -q 'REVIEW ONLY' "$location_guard_log"
rm -f "$location_guard_log"
location_schema_exists=$(docker exec "$location_container" psql -X -U postgres -d location_wrong_db -At -c "select count(*) from pg_namespace where nspname='location_private'")
[ "$location_schema_exists" = 0 ]
echo 'PASS: non-test database rejected before any DDL'

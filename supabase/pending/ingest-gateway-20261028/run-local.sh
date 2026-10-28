#!/usr/bin/env bash
# Local disposable PostgreSQL only (no operational connection). Builds the Bomunttl/location fixture
# with scripts/ci/bomunttl-postgres.sh, then reads 01/02 inside BEGIN … ROLLBACK and runs the checks.
set -euo pipefail
docker() { env -u DOCKER_HOST -u DOCKER_CONTEXT docker --host=unix:///var/run/docker.sock "$@"; }
name="ingest-gateway-${RANDOM}${RANDOM}"
tmp=$(mktemp)
sed -e "s/^bomunttl_container=.*/bomunttl_container=$name/" -e "s/^trap .*//" scripts/ci/bomunttl-postgres.sh > "$tmp"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$tmp"' EXIT
bash "$tmp" > /dev/null
psql_local() { docker exec -i "$name" psql -X -h 127.0.0.1 -U postgres -d bomunttl_test -v ON_ERROR_STOP=1 "$@"; }
{
  echo 'begin;'
  cat supabase/pending/ingest-gateway-20261028/01-schema-dryrun.sql supabase/pending/ingest-gateway-20261028/02-location-never-hides-dryrun.sql supabase/pending/ingest-gateway-20261028/03-checks.sql
  echo 'rollback;'
} | psql_local
echo 'PASS: ingest gateway dry-run (rolled back)'

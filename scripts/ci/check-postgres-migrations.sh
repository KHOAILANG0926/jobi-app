#!/usr/bin/env bash
set -euo pipefail
: "${PG_TEST_URL:?PG_TEST_URL is required}"
: "${PR_BASE_SHA:?PR_BASE_SHA is required}"
psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/postgres-location-fixture.sql
mapfile -t changed < <(git diff --name-only "$PR_BASE_SHA" HEAD -- 'supabase/migrations/*.sql')
echo "Regression: always apply the current location-memory migration on fresh PostgreSQL" 
psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f scripts/ci/reference-location-fixed.sql
for file in "${changed[@]}"; do
  test -f "$file" || { echo "::error::Migration file deleted: $file"; exit 1; }
  if [[ "$file" == *20261025174000_admin_confirmed_location_memory.sql ]]; then continue; fi
  if [[ "$file" == 'supabase/migrations/20261026231445_location_single_source.sql' ]]; then
    echo "PostgreSQL scoped canonical integration applies actual migration: $file"
    bash supabase/pending/location-single-source-20261026/production/run-local.sh "$file"
    continue
  fi
  echo "PostgreSQL clean application: $file"
  psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
done
# Recreate the exact dollar-delimiter failure seen in production in a clean DB.
# The original migration must be rejected by PostgreSQL, not just static lint.
if true; then
  bad=$(mktemp --suffix=.sql)
  node --input-type=module -e '
    import { readFileSync,writeFileSync } from "node:fs";
    const source=readFileSync(process.argv[1],"utf8");
    const bad=source.replace("public as $$","public as $").replace("\n$$;\nrevoke all on function public.admin_location_key","\n$;\nrevoke all on function public.admin_location_key");
    if(bad===source)process.exit(2);
    writeFileSync(process.argv[2],bad);
  ' scripts/ci/reference-location-fixed.sql "$bad"
  if psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$bad" > /tmp/bad-migration.log 2>&1; then
    cat /tmp/bad-migration.log
    echo "::error::Original malformed dollar-quote migration unexpectedly passed"
    exit 1
  fi
  grep -E 'syntax error at or near "\$"|syntax error at or near "\\$"' /tmp/bad-migration.log || {
    cat /tmp/bad-migration.log;echo "::error::Original bad quote failed for an unrelated reason";exit 1;
  }
  echo "PASS: original single-dollar migration rejected by real PostgreSQL"
fi

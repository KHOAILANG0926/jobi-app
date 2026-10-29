#!/usr/bin/env bash
set -euo pipefail
: "${PG_TEST_URL:?PG_TEST_URL is required}"
: "${PR_BASE_SHA:?PR_BASE_SHA is required}"
psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/postgres-location-fixture.sql
mapfile -t changed < <(git diff --name-only "$PR_BASE_SHA" HEAD -- 'supabase/migrations/*.sql')
echo "Regression: always apply the current location-memory migration on fresh PostgreSQL" 
psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f scripts/ci/reference-location-fixed.sql
bomunttl_checked=0
for file in "${changed[@]}"; do
  test -f "$file" || { echo "::error::Migration file deleted: $file"; exit 1; }
  if [[ "$file" == *20261025174000_admin_confirmed_location_memory.sql ]]; then continue; fi
  if [[ "$file" == 'supabase/migrations/20261026231445_location_single_source.sql' ]]; then
    echo "PostgreSQL scoped canonical integration applies actual migration: $file"
    bash supabase/pending/location-single-source-20261026/production/run-local.sh "$file"
    bash supabase/pending/location-single-source-20261026/production/check-hook-compatibility-local.sh
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261027042533_location_company_index_execute.sql' ]]; then
    bash supabase/pending/location-single-source-20261026/production/run-local.sh supabase/migrations/20261026231445_location_single_source.sql "$file"
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261028051147_multi_role_presentation_rules.sql' ]]; then
    if [[ "$bomunttl_checked" == 0 ]]; then bash scripts/ci/bomunttl-postgres.sh; bomunttl_checked=1; fi
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261028050507_administrative_area_fallback.sql' ]]; then
    bash supabase/pending/location-single-source-20261026/production/run-local.sh supabase/migrations/20261026231445_location_single_source.sql supabase/migrations/20261027042533_location_company_index_execute.sql "$file"
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261028080000_area_pin_releases_unlocated_hold.sql' || "$file" == 'supabase/migrations/20261028093000_clear_multi_role_auto_meal.sql' || "$file" == 'supabase/migrations/20261028160000_ingest_gateway.sql' || "$file" == 'supabase/migrations/20261029010000_ingest_one_door.sql' || "$file" == 'supabase/migrations/20261029120000_area_pin_needs_source_text.sql' ]]; then
    if [[ "$bomunttl_checked" == 0 ]]; then bash scripts/ci/bomunttl-postgres.sh; bomunttl_checked=1; fi
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261028034009_lee_verified_sources.sql' || "$file" == 'supabase/migrations/20261028034036_register_bomunttl.sql' ]]; then
    if [[ "$bomunttl_checked" == 0 ]]; then bash scripts/ci/bomunttl-postgres.sh; bomunttl_checked=1; fi
    continue
  fi
  echo "PostgreSQL clean application: $file"
  psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
done
# 입구 전환: 공고 내용 파일 변환기·파일이 바뀌면 실제 PostgreSQL에서 ingest_job 경로를 시험한다.
if [[ "$bomunttl_checked" == 0 ]] && git diff --name-only "$PR_BASE_SHA" HEAD -- scripts/ops/ingest-sql.mjs 'scripts/ops/jobs/*.json' test-fixtures/ops .github/workflows/ops-insert-job.yml | grep -q .; then
  bash scripts/ci/bomunttl-postgres.sh; bomunttl_checked=1
fi
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

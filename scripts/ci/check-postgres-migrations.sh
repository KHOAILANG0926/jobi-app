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
  if [[ "$file" == 'supabase/migrations/20261028080000_area_pin_releases_unlocated_hold.sql' || "$file" == 'supabase/migrations/20261028093000_clear_multi_role_auto_meal.sql' || "$file" == 'supabase/migrations/20261028160000_ingest_gateway.sql' || "$file" == 'supabase/migrations/20261029010000_ingest_one_door.sql' || "$file" == 'supabase/migrations/20261029120000_area_pin_needs_source_text.sql' || "$file" == 'supabase/migrations/20261029140000_recheck_area_pins_with_goong.sql' || "$file" == 'supabase/migrations/20261029160000_delete_job_5063_no_info.sql' ]]; then
    if [[ "$bomunttl_checked" == 0 ]]; then bash scripts/ci/bomunttl-postgres.sh; bomunttl_checked=1; fi
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261028034009_lee_verified_sources.sql' || "$file" == 'supabase/migrations/20261028034036_register_bomunttl.sql' ]]; then
    if [[ "$bomunttl_checked" == 0 ]]; then bash scripts/ci/bomunttl-postgres.sh; bomunttl_checked=1; fi
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261031070500_admin_r7_read.sql' ]]; then
    echo "PostgreSQL scoped R7 admin diagnostic fixture: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
create or replace function public.is_admin() returns boolean language sql stable as 'select false';
alter table public.local_jobs
  add column active boolean, add column admin_hidden boolean,
  add column publish_gate_reason text, add column policy_decision text,
  add column ocr_check jsonb, add column ocr_text text, add column images jsonb,
  add column title text, add column salary text, add column contact_name text,
  add column employer_phone text, add column contact_zalo text,
  add column age_min integer, add column age_max integer;
SQL
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/admin_r7_read_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101110000_job_inspect_content_hash.sql' ]]; then
    echo "PostgreSQL inspect publication gate: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "alter table public.local_jobs add column if not exists origin text, add column if not exists title text, add column if not exists description text, add column if not exists salary text, add column if not exists source_text text, add column if not exists ocr_text text, add column if not exists images jsonb, add column if not exists active boolean, add column if not exists admin_hidden boolean default false, add column if not exists ocr_check jsonb"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"   # 두 번 적용해도 같은 결과
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/job_inspect_content_hash.local.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/job_inspect_content_hash_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101150000_rule_check_refs.sql' ]]; then
    echo "PostgreSQL rule = check gate: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/rule-check-refs-fixture.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"   # 두 번 적용해도 같은 결과
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rule_check_refs.local.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rule_check_refs_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101170000_inspect_keep_public.sql' ]]; then
    echo "PostgreSQL keep public during reprocess: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "alter table public.local_jobs add column if not exists origin text, add column if not exists title text, add column if not exists description text, add column if not exists salary text, add column if not exists source_text text, add column if not exists ocr_text text, add column if not exists images jsonb, add column if not exists active boolean, add column if not exists admin_hidden boolean default false, add column if not exists ocr_check jsonb"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261101110000_job_inspect_content_hash.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/inspect_keep_public.local.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/job_inspect_content_hash_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101180000_u1_resolved_by_pin_order.sql' ]]; then
    echo "PostgreSQL rule record update: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/rule-check-refs-fixture.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261101150000_rule_check_refs.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rule_check_refs_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101190000_db_publish_gate.sql' ]]; then
    echo "PostgreSQL DB publish gate: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/rule-check-refs-fixture.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "alter table public.job_posting_rules add column if not exists block_mode text, add column if not exists machine_checkable text, add column if not exists implementation text"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261101150000_rule_check_refs.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "alter table public.local_jobs add column if not exists origin text, add column if not exists title text, add column if not exists active boolean, add column if not exists publish_gate_reason text, add column if not exists employer_phone text, add column if not exists contact_zalo text, add column if not exists recruitment_regions text[]"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/db_publish_gate.local.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/db_publish_gate_production_check.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rule_check_refs_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101200000_business_kind_category.sql' ]]; then
    echo "PostgreSQL business kind category: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "alter table public.local_jobs add column if not exists category text default 'khac', add column if not exists title text default '', add column if not exists company text default '', add column if not exists description text, add column if not exists source_text text, add column if not exists active boolean default false, add column if not exists admin_hidden boolean default false, add column if not exists ocr_check jsonb"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "create table if not exists public.job_posting_rules(rule_key text unique,content text,decided_on date,incidents text,machine_checkable text,block_mode text,implementation text)"
    for dep in 20261015100000_occupation_master.sql 20261015100100_occupation_master_seed.sql 20261015120000_local_jobs_occupation_r8.sql 20261017070517_occupation_publication_gate.sql 20261018090000_occupation_code_any_level.sql 20261021224712_occupation_category_auto.sql; do
      psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/$dep" >/dev/null
    done
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/business_kind_category.local.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/business_kind_category_production_check.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/occupation_category_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101210000_brands_verified_chains.sql' ]]; then
    echo "PostgreSQL verified brands: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/brands-fixture.sql
    psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20260910120000_job_brands_master.sql >/dev/null
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/brands_verified_chains_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101230000_brand_logo_domains.sql' ]]; then
    echo "PostgreSQL brand logo domains: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/brands-fixture.sql
    if [[ "$(psql "$PG_TEST_URL" -X -At -c "select to_regclass('public.job_brands') is null")" == t ]]; then
      psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20260910120000_job_brands_master.sql >/dev/null
      psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261101210000_brands_verified_chains.sql >/dev/null
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/brand_logo_domains_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261101220000_brand_categories_30.sql' ]]; then
    echo "PostgreSQL brand categories: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/brands-fixture.sql
    if [[ "$(psql "$PG_TEST_URL" -X -At -c "select to_regclass('public.job_brands') is null")" == t ]]; then
      psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20260910120000_job_brands_master.sql >/dev/null
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "insert into public.job_brands(name,slug,category,initial,color) values ('T','t-chicken','chicken_pizza','T','#000')"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "do \$\$ begin begin insert into public.job_brands(name,slug,category,initial,color) values ('F','f-factory','factory','F','#000'); raise exception 'factory accepted'; exception when check_violation then null; end; end \$\$"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/brand_categories_30_production_check.sql
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

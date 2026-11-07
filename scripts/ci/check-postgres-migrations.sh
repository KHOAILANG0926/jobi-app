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
  if [[ "$file" == 'supabase/migrations/20261028080000_area_pin_releases_unlocated_hold.sql' || "$file" == 'supabase/migrations/20261028093000_clear_multi_role_auto_meal.sql' || "$file" == 'supabase/migrations/20261028160000_ingest_gateway.sql' || "$file" == 'supabase/migrations/20261029010000_ingest_one_door.sql' || "$file" == 'supabase/migrations/20261029120000_area_pin_needs_source_text.sql' || "$file" == 'supabase/migrations/20261029140000_recheck_area_pins_with_goong.sql' || "$file" == 'supabase/migrations/20261103210000_recheck_area_pins_company_name.sql' || "$file" == 'supabase/migrations/20261029160000_delete_job_5063_no_info.sql' ]]; then
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
  if [[ "$file" == 'supabase/migrations/20261103000000_r8_any_level_restore.sql' ]]; then
    # 2026-11-03: 옛 10-15 정의가 다시 덮어써진 상태(11-02 사고)를 재현 → 이 파일이 10-18 규칙으로 되돌리는지 확인.
    echo "PostgreSQL R8 any-level restore: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "alter table public.local_jobs add column if not exists category text default 'khac', add column if not exists title text default '', add column if not exists company text default '', add column if not exists description text, add column if not exists source_text text, add column if not exists active boolean default false, add column if not exists admin_hidden boolean default false, add column if not exists ocr_check jsonb"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "create table if not exists public.job_posting_rules(rule_key text unique,content text,decided_on date,incidents text,machine_checkable text,block_mode text,implementation text)"
    for dep in 20261015100000_occupation_master.sql 20261015100100_occupation_master_seed.sql 20261015120000_local_jobs_occupation_r8.sql 20261017070517_occupation_publication_gate.sql 20261018090000_occupation_code_any_level.sql 20261015120000_local_jobs_occupation_r8.sql; do
      psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/$dep" >/dev/null
    done
    if psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/r8_any_level_restore_production_check.sql >/dev/null 2>&1; then
      echo "::error::옛 정의 재현 상태에서 점검이 통과함(점검이 사고를 못 잡음)"; exit 1
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/r8_any_level_restore_production_check.sql
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
  if [[ "$file" == 'supabase/migrations/20261103190000_brand_categories_restaurant_retail.sql' ]]; then
    echo "PostgreSQL brand categories restaurant/retail: $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/brands-fixture.sql
    if [[ "$(psql "$PG_TEST_URL" -X -At -c "select to_regclass('public.job_brands') is null")" == t ]]; then
      for dep in 20260910120000_job_brands_master.sql 20261101210000_brands_verified_chains.sql 20261101230000_brand_logo_domains.sql; do
        psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/$dep" >/dev/null
      done
    fi
    # 적용 전에는 식당 분류가 거부돼야 한다(시험이 실제 변화를 잡는지).
    if psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "begin; insert into public.job_brands(name,slug,category,initial,color) values ('t','ci-restaurant','restaurant','T','#000'); rollback;" >/dev/null 2>&1; then
      echo "::error::적용 전인데 restaurant 분류가 허용됨"; exit 1
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/brand_categories_restaurant_retail_production_check.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/brand_logo_domains_production_check.sql
    if psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -c "begin; insert into public.job_brands(name,slug,category,initial,color) values ('t','ci-factory','factory','T','#000'); rollback;" >/dev/null 2>&1; then
      echo "::error::factory(공장) 분류가 허용됨"; exit 1
    fi
    continue
  fi
  if [[ "$file" =~ ^supabase/migrations/[0-9]+_brand_logo(_image|_[a-z0-9_]+)\.sql$ ]]; then
    echo "PostgreSQL brand logo image (Lee 2026-11-07): brands, then $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/brands-fixture.sql
    if [[ "$(psql "$PG_TEST_URL" -X -At -c "select to_regclass('public.job_brands') is null")" == t ]]; then
      for dep in 20260910120000_job_brands_master.sql 20261101210000_brands_verified_chains.sql 20261101230000_brand_logo_domains.sql 20261103190000_brand_categories_restaurant_retail.sql; do
        psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/$dep" >/dev/null
      done
    fi
    if [[ "$file" != *_brand_logo_image.sql ]]; then
      psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261107180000_brand_logo_image.sql >/dev/null 2>&1 || true
      psql "$PG_TEST_URL" -X -q -c "insert into public.job_brands (name, slug, category, domain, initial, color, active, featured, verified_branches, evidence_url, evidence_note, verified_on) values ('NETCO POST','netco-post','delivery','netco.com.vn','N','#0a8f3c',true,true,81,'https://netco.com.vn/vi/contact/post-offices','x','2026-11-07') on conflict (slug) do nothing" >/dev/null 2>&1 || true
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/brand_logo_image_production_check.sql
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261107150000_logo_lookup_api_limits.sql' ]]; then
    echo "PostgreSQL logo lookup + API limits (Lee 2026-11-07): brands + anon/service roles, then $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/brands-fixture.sql
    if [[ "$(psql "$PG_TEST_URL" -X -At -c "select to_regclass('public.job_brands') is null")" == t ]]; then
      for dep in 20260910120000_job_brands_master.sql 20261101210000_brands_verified_chains.sql 20261101230000_brand_logo_domains.sql 20261103190000_brand_categories_restaurant_retail.sql; do
        psql "$PG_TEST_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/$dep" >/dev/null
      done
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/logo_lookup_api_limits_production_check.sql
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
do $t$
declare r text; ok boolean; i int;
begin
  insert into public.local_jobs(id, company, location) values (990001, 'Cty A', 'Bắc Ninh');
  -- 등록 경로로는 회사 웹사이트를 넣을 수 없다
  update public.local_jobs set company_domain = 'evil.com' where id = 990001;
  if (select company_domain from public.local_jobs where id = 990001) is not null then raise exception '보호 장치 실패'; end if;
  r := public.job_logo_lookup_record(990001, 'found', 'https://www.facebook.com/x', 'p1');
  if r <> 'none' then raise exception 'URL 형식 처리 오류: %', r; end if;
  r := public.job_logo_lookup_record(990001, 'found', 'facebook.com', 'p1');
  if r <> 'excluded' then raise exception '페이스북 제외 실패: %', r; end if;
  r := public.job_logo_lookup_record(990001, 'found', 'www.Netco.com.vn', 'p1');
  if r <> 'found' or (select company_domain from public.local_jobs where id = 990001) <> 'netco.com.vn' then raise exception '도메인 기록 실패'; end if;
  -- 월 한도: 900에서 멈춤
  for i in 1..900 loop ok := public.external_api_reserve('google_place_website'); if not ok then raise exception '한도 전에 멈춤 %', i; end if; end loop;
  if public.external_api_reserve('google_place_website') then raise exception '한도 넘김'; end if;
  if (select calls from public.external_api_calls where api = 'google_place_website') <> 900 then raise exception '횟수 오류'; end if;
  raise notice 'logo lookup CI cases passed';
end $t$;
SQL
    continue
  fi
  if [[ "$file" == 'supabase/migrations/20261107070000_job_duplicate_check.sql' ]]; then
    echo "PostgreSQL duplicate check (Lee 2026-11-07): company codes + needed columns, then $file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
create or replace function public.is_admin() returns boolean language sql stable as 'select false';
alter table public.local_jobs
  add column if not exists title text, add column if not exists occupation_code text,
  add column if not exists active boolean not null default true, add column if not exists admin_hidden boolean not null default false,
  add column if not exists created_at timestamptz not null default now();
alter table public.job_work_locations
  add column if not exists point_kind text not null default 'unresolved', add column if not exists point_authority text not null default 'unresolved';
SQL
    if ! psql "$PG_TEST_URL" -X -At -c "select to_regclass('public.job_companies') is not null" | grep -q t; then
      psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261106230000_job_company_codes.sql
    fi
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/job_duplicate_check_production_check.sql
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

#!/usr/bin/env bash
set -euo pipefail
: "${PG_TEST_URL:?PG_TEST_URL is required}"
: "${PR_BASE_SHA:?PR_BASE_SHA is required}"
psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f scripts/ci/postgres-location-fixture.sql
mapfile -t changed < <(git diff --name-only "$PR_BASE_SHA" HEAD -- 'supabase/migrations/*.sql')
echo "Regression: always apply the current location-memory migration on fresh PostgreSQL" 
psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f scripts/ci/reference-location-fixed.sql
bomunttl_checked=0
# 바뀐 migration마다 같은 방식(2026-11-09 공통화 — 예전에는 파일 이름별 예외를 하나씩 덧붙였음, 27곳):
#   ① supabase/tests/<이름>.setup.sql 이 있으면 먼저 실행(빈 시험 DB에 없는 칸·함수 등 준비)
#   ② migration 적용(한 트랜잭션)
#   ③ supabase/tests/<이름>.local.sql 이 있으면 실행(시험 DB 전용 확인)
#   ④ supabase/tests/<이름>_production_check.sql 이 있고 ①이나 ③이 있으면 실행(준비가 있는 경우만 — 빈 DB에선 운영 점검이 칸 부족으로 실패)
# <이름> = 파일 이름에서 앞의 시각_ 과 .sql 을 뺀 것. 새 준비·시험은 이 이름 규칙의 파일로 넣고 이 스크립트는 고치지 않는다.
# 이미 운영에 적용된 migration은 다시 바뀌지 않으므로(파일 삭제는 위에서 막음) 예전 파일별 시험은 다시 실행될 일이 없어 뺐다(git 기록에 남음).
for file in "${changed[@]}"; do
  test -f "$file" || { echo "::error::Migration file deleted: $file"; exit 1; }
  stem=$(basename "$file" .sql); stem=${stem#*_}
  setup="supabase/tests/$stem.setup.sql"; local_check="supabase/tests/$stem.local.sql"; prod_check="supabase/tests/${stem}_production_check.sql"
  echo "PostgreSQL migration: $file (시험 이름 $stem)"
  [[ -f "$setup" ]] && psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f "$setup"
  psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -1 -f "$file"
  [[ -f "$local_check" ]] && psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f "$local_check"
  if [[ -f "$prod_check" ]] && { [[ -f "$setup" ]] || [[ -f "$local_check" ]]; }; then
    psql "$PG_TEST_URL" -X -v ON_ERROR_STOP=1 -f "$prod_check"
  fi
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

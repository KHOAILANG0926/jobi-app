#!/usr/bin/env bash
# S3-5(#808): DB 변경이 들어간 커밋은 운영 DB 적용(migrations-apply)이 성공한 뒤에만 운영 배포한다(vercel-deploy.yml이 부름).
# 입력 환경: PROD(운영에 배포된 커밋, 모르면 빈 값), REPO(owner/repo), WAIT_TRIES(기본 40)·WAIT_SEC(기본 30). gh·git 필요. 저장소 루트에서 실행.
# 종료: 0 = 배포 진행, 1 = 배포 보류(실패·시간 초과·git 오류 — 닫힌 실패). 시험: scripts/ci/wait-migration-before-deploy.test.sh
set -euo pipefail
# 운영 버전을 모르면(수동 강제 배포·기록 없음) 지금까지의 마지막 DB 변경 커밋을 기준으로 한다 — 이미 적용됐다면
# 그 뒤 커밋의 migrations-apply 성공 기록이 그 커밋을 포함하므로 바로 통과한다. git 오류는 실패로 끝난다(닫힌 실패).
if [ -n "${PROD:-}" ] && git cat-file -e "${PROD}^{commit}" 2>/dev/null; then range="${PROD}..HEAD"; else range="HEAD"; fi
last_mig=$(git log -1 --format=%H "$range" -- supabase/migrations)
if [ -z "$last_mig" ]; then echo "- DB 변경 없음: migration 대기 생략" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; exit 0; fi
echo "운영 버전 이후 DB 변경 커밋: ${last_mig:0:7} — migrations-apply 성공을 기다린다"
for attempt in $(seq 1 "${WAIT_TRIES:-40}"); do
  verdict=none
  while IFS=$'\t' read -r rid rsha rstatus rconc; do
    [ -n "$rid" ] || continue
    git cat-file -e "$rsha^{commit}" 2>/dev/null || git fetch -q origin "$rsha" 2>/dev/null || continue
    git merge-base --is-ancestor "$last_mig" "$rsha" || continue
    # 이 DB 변경을 포함한 가장 최근 실행 하나로 판정한다.
    if [ "$rstatus" != completed ]; then verdict=wait; elif [ "$rconc" = success ]; then verdict=ok; else verdict="fail:$rid:$rconc"; fi
    break
  done < <(gh api "repos/$REPO/actions/workflows/migrations-apply.yml/runs?branch=master&per_page=20" --jq '.workflow_runs[] | [.id, .head_sha, .status, (.conclusion // "")] | @tsv')
  case "$verdict" in
    ok) echo "- DB 적용 성공 확인 뒤 배포(${last_mig:0:7})" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; exit 0 ;;
    fail:*) echo "::error::운영 DB 적용 실패(${verdict}) — 운영 배포 보류. migration을 고친 뒤 다시 배포된다."; exit 1 ;;
  esac
  sleep "${WAIT_SEC:-30}"
done
echo "::error::20분 안에 이 DB 변경(${last_mig:0:7})을 포함한 migrations-apply 성공 기록이 없음 — 운영 배포 보류"; exit 1

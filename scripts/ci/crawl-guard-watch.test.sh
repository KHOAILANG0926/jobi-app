#!/usr/bin/env bash
# crawl-guard.yml ⑧(수집 실행 실패·신규 저장 0건 경고, Lee 2026-11-17 트랙 B) 회귀 시험.
# 워크플로의 ⑧ 셸을 그대로 잘라 가짜 gh·DB로 돌린다(네트워크·열쇠 없음).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
awk '/# ⑧ 수집 실행 실패/{f=1} f{print} /done <<<"\$watch"/{if(f)exit}' "$ROOT/.github/workflows/crawl-guard.yml" | sed 's/^          //' > "$T/block.sh"
grep -q 'done <<<"$watch"' "$T/block.sh" || { echo "FAIL: ⑧ 블록을 못 찾음"; exit 1; }
cat > "$T/bin/gh" <<'GH'
#!/bin/bash
echo "GH $*" >> "$CALLS"
case "$*" in
  *"/runs?status=completed"*) echo "$FAKE_RUNS_JSON" | jq -r "${@: -1}";;
  "issue list"*) echo "$FAKE_ISSUE";;
  *"/comments"*) echo "$FAKE_COMMENTS";;
  *) echo "";;
esac
GH
chmod +x "$T/bin/gh"
now=$(date -u +%Y-%m-%dT%H:%M:%SZ); old=$(date -u -d '-30 hours' +%Y-%m-%dT%H:%M:%SZ)
fail=0
# 7번째 인자 = 볼 경로 줄(기본: 신규 저장 0건까지 보는 vieclam24h 한 줄 — 아래 옛 사례). 비우면 워크플로의 기본 줄(두 경로)을 그대로 쓴다.
NEWCHECK="vieclam24h crawl.yml fail_and_new"
check() {  # 이름 runs_json 열린이슈 신규건수 기존댓글 기대(issue 동작 목록) [볼 경로 줄: 없으면 NEWCHECK, "default"면 워크플로 기본]
  export CALLS="$T/calls" FAKE_RUNS_JSON="$2" FAKE_ISSUE="$3" NEW="$4" FAKE_COMMENTS="$5"
  if [ "${7:-}" = default ]; then unset CRAWL_WATCH; else export CRAWL_WATCH="${7:-$NEWCHECK}"; fi
  : > "$CALLS"
  PATH="$T/bin:$PATH" REPO=o/r GITHUB_STEP_SUMMARY="$T/sum" bash -c 'set -euo pipefail; q(){ echo "$NEW"; }; source "'"$T"'/block.sh"'
  got=$( { grep -oE 'issue (create|comment|close)' "$CALLS" || true; } | tr '\n' ' ' | sed 's/ $//')
  if [ "$got" = "$6" ]; then echo "ok   $1"; else echo "FAIL $1: 기대 [$6] 실제 [$got]"; fail=1; fi
}
r() { printf '{"workflow_runs":[%s]}' "$1"; }
run() { printf '{"id":%s,"conclusion":"%s","run_started_at":"%s"}' "$1" "$2" "$3"; }
check "실행 실패 → 이슈"              "$(r "$(run 11 failure "$now")")" "" 0 "" "issue create"
check "성공·신규 0건 → 이슈"          "$(r "$(run 12 success "$now")")" "" 0 "" "issue create"
check "정상 + 열린 이슈 → 닫음"       "$(r "$(run 13 success "$now")")" "900" 4 "" "issue comment issue close"
check "정상 → 동작 없음"              "$(r "$(run 14 success "$now")")" "" 4 "" ""
check "같은 실행 재알림 없음"         "$(r "$(run 11 failure "$now")")" "900" 0 "x (run 11) x" ""
check "run 111 기록이 run 11을 가리지 않음" "$(r "$(run 11 failure "$now")")" "900" 0 "x (run 111) x" "issue comment"
check "건너뜀 뒤 수동 실패 → 이슈"    "$(r "$(run 21 skipped "$now"),$(run 20 failure "$now")")" "" 0 "" "issue create"
check "건너뜀 뒤 수동 정상 → 없음"    "$(r "$(run 21 skipped "$now"),$(run 20 success "$now")")" "" 5 "" ""
check "건너뜀만 → 없음"               "$(r "$(run 21 skipped "$now")")" "" 0 "" ""
check "26시간 넘은 실행 → 없음"       "$(r "$(run 30 failure "$old")")" "" 0 "" ""
# 수집 정지 감시 보강(Lee 2026-11-22, S1-WATCH-1): 수동 전용 경로는 실행 실패만 본다(저장 없는 미리 보기·보류함 확인 뒤 신규 0건은 정상), Facebook도 본다.
check "수동 전용(fail): 성공·신규 0건 → 오보 없음" "$(r "$(run 40 success "$now")")" "" 0 "" "" "facebook crawl-facebook-one.yml fail"
check "수동 전용(fail): 실행 실패(계정 잠금) → 이슈" "$(r "$(run 41 failure "$now")")" "" 0 "" "issue create" "facebook crawl-facebook-one.yml fail"
check "수동 전용(fail): 정상 + 열린 이슈 → 닫음" "$(r "$(run 42 success "$now")")" "900" 0 "" "issue comment issue close" "facebook crawl-facebook-one.yml fail"
check "기본 감시 줄: 두 경로(vieclam24h·Facebook) 모두 실행 실패를 본다" "$(r "$(run 43 failure "$now")")" "" 0 "" "issue create issue create" default
check "기본 감시 줄: 성공·신규 0건은 어느 경로도 오보 없음" "$(r "$(run 44 success "$now")")" "" 0 "" "" default
exit $fail

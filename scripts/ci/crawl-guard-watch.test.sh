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
check() {  # 이름 runs_json 열린이슈 신규건수 기존댓글 기대(issue 동작 목록)
  export CALLS="$T/calls" FAKE_RUNS_JSON="$2" FAKE_ISSUE="$3" NEW="$4" FAKE_COMMENTS="$5"
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
check "같은 실행 재알림 없음"         "$(r "$(run 11 failure "$now")")" "900" 0 "x run 11 x" ""
check "건너뜀 뒤 수동 실패 → 이슈"    "$(r "$(run 21 skipped "$now"),$(run 20 failure "$now")")" "" 0 "" "issue create"
check "건너뜀 뒤 수동 정상 → 없음"    "$(r "$(run 21 skipped "$now"),$(run 20 success "$now")")" "" 5 "" ""
check "건너뜀만 → 없음"               "$(r "$(run 21 skipped "$now")")" "" 0 "" ""
check "26시간 넘은 실행 → 없음"       "$(r "$(run 30 failure "$old")")" "" 0 "" ""
exit $fail

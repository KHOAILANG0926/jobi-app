#!/usr/bin/env bash
# check-secret-isolation.py 시험: 악성 워크플로 흉내(fixtures/workflows/bad-*)는 각자 기대한 규칙으로 걸리고,
# 올바른 방식(good-*)과 실제 저장소 워크플로는 0건이어야 한다.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd); fx="$here/fixtures/workflows"
pass=0; fail=0
expect() { # 파일 규칙들...
  local f=$1; shift; local out; out=$(python3 "$here/check-secret-isolation.py" "$fx/$f" 2>&1)
  for r in "$@"; do echo "$out" | grep -q "^$r " && pass=$((pass+1)) || { echo "FAIL: $f 에서 $r 안 걸림"; echo "$out" | sed 's/^/  /'; fail=$((fail+1)); }; done
}
expect bad-r1-crawl-guard.yml R1
expect bad-r2-persist.yml R2
expect bad-r3-claude-tools.yml R3 R1
expect bad-r4-artifact.yml R4
expect bad-r1-fake-sandbox.yml R1
expect bad-r1-worktree.yml R1
expect bad-r1-no-permissions.yml R2 R1
out=$(python3 "$here/check-secret-isolation.py" "$fx/good-sandboxed.yml"); [ $? = 0 ] && pass=$((pass+1)) || { echo "FAIL: 올바른 방식이 걸림"; echo "$out"; fail=$((fail+1)); }
echo "check-secret-isolation: 통과 $pass, 실패 $fail"
[ "$fail" = 0 ]

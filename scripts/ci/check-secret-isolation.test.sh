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
expect bad-r5-claude-settings.yml R5 R6
expect bad-r6-claude-write.yml R6 R1
expect bad-r7-injection.yml R7 R6
expect bad-r8-no-environment.yml R8
# 독립 검토가 찾은 우회 모양(bun·tsx·env npm·node_modules/.bin·sh·bash -c·shell: python·uses: ./·gh pr checkout·FETCH_HEAD·git apply·
# 믿는 경로와 섞인 줄·pull_request 계열 기본 ref·gh run download·echo/continue-on-error/|| true 출처 확인·$( ) 안 명령): 잡마다 걸려야 함
bout=$(python3 "$here/check-secret-isolation.py" "$fx/bad-bypass.yml")
for j in $(python3 -c "import yaml,sys;print(' '.join(yaml.safe_load(open(sys.argv[1]))['jobs']))" "$fx/bad-bypass.yml"); do
  echo "$bout" | grep -q "jobs\.$j\." && pass=$((pass+1)) || { echo "FAIL: bad-bypass.yml 잡 $j 안 걸림"; fail=$((fail+1)); }
done
out=$(python3 "$here/check-secret-isolation.py" "$fx/good-sandboxed.yml"); [ $? = 0 ] && pass=$((pass+1)) || { echo "FAIL: 올바른 방식이 걸림"; echo "$out"; fail=$((fail+1)); }
echo "check-secret-isolation: 통과 $pass, 실패 $fail"
[ "$fail" = 0 ]

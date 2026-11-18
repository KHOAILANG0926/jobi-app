#!/usr/bin/env bash
# verify-artifact-run.sh 시험: 가짜 gh로 '악성 실행'(브랜치·다른 파일·포크·push·실패·master 밖 커밋)이 모두 거절되는지 본다.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/gh" <<'G'
#!/usr/bin/env bash
# 가짜 gh: FAKE_RUN(JSON)과 FAKE_COMPARE(상태)를 돌려준다.
case "$2" in
  */actions/runs/*) printf '%s' "$FAKE_RUN" ;;
  */compare/*) printf '%s\n' "$FAKE_COMPARE" ;;
  *) exit 1 ;;
esac
G
chmod +x "$tmp/gh"
export PATH="$tmp:$PATH" GITHUB_REPOSITORY=o/r GH_TOKEN=x
good='{"repository":{"full_name":"o/r"},"head_repository":{"full_name":"o/r"},"path":".github/workflows/a.yml","head_branch":"master","event":"workflow_dispatch","status":"completed","conclusion":"success","head_sha":"abc1234"}'
pass=0; failn=0
check() { # 이름 기대(0=통과,1=거절) run_json compare ref
  local name=$1 want=$2
  FAKE_RUN=$3 FAKE_COMPARE=$4 GITHUB_REF=$5 bash "$here/verify-artifact-run.sh" 42 .github/workflows/a.yml >/dev/null 2>&1; local got=$?
  [ "$got" -ne 0 ] && got=1
  if [ "$got" = "$want" ]; then pass=$((pass+1)); else echo "FAIL: $name (기대 $want, 실제 $got)"; failn=$((failn+1)); fi
}
mut() { printf '%s' "$good" | jq -c "$1"; }
check '정상 실행' 0 "$good" ahead refs/heads/master
check '정상(같은 커밋)' 0 "$good" identical refs/heads/master
check '지금 실행이 브랜치' 1 "$good" ahead refs/heads/evil
check '브랜치 실행의 artifact' 1 "$(mut '.head_branch="evil"')" ahead refs/heads/master
check '다른 워크플로 파일' 1 "$(mut '.path=".github/workflows/evil.yml"')" ahead refs/heads/master
check '포크 실행' 1 "$(mut '.head_repository.full_name="x/r"')" ahead refs/heads/master
check 'push 실행(수동만 허용)' 1 "$(mut '.event="push"')" ahead refs/heads/master
check '실패 실행' 1 "$(mut '.conclusion="failure"')" ahead refs/heads/master
check 'master 이름 흉내(이력 밖 커밋)' 1 "$good" diverged refs/heads/master
check 'master 이름 흉내(behind)' 1 "$good" behind refs/heads/master
FAKE_RUN="$(mut '.event="push"')" FAKE_COMPARE=ahead GITHUB_REF=refs/heads/master bash "$here/verify-artifact-run.sh" 42 .github/workflows/a.yml push,workflow_dispatch >/dev/null 2>&1 && pass=$((pass+1)) || { echo "FAIL: push 허용 목록"; failn=$((failn+1)); }
FAKE_RUN=$good FAKE_COMPARE=ahead GITHUB_REF=refs/heads/master bash "$here/verify-artifact-run.sh" 42 .github/workflows/a.yml 'push;x' >/dev/null 2>&1 && { echo "FAIL: 이벤트 주입"; failn=$((failn+1)); } || pass=$((pass+1))
FAKE_RUN=$good FAKE_COMPARE=ahead GITHUB_REF=refs/heads/master bash "$here/verify-artifact-run.sh" '1;rm' .github/workflows/a.yml >/dev/null 2>&1 && { echo "FAIL: run id 주입"; failn=$((failn+1)); } || pass=$((pass+1))
echo "verify-artifact-run: 통과 $pass, 실패 $failn"
[ "$failn" = 0 ]

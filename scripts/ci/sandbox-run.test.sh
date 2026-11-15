#!/usr/bin/env bash
# S4(#808) 악성 PR 시험: sandbox-run.sh 상자 안의 PR 코드가 호스트의 열쇠를 못 읽고, 밖으로 못 보내고, 호스트 파일을 못 고치는지 본다.
# 호스트에 가짜 열쇠(S4FAKE-…)를 환경변수·.git 설정(actions/checkout이 토큰을 두는 곳)·홈 설정 파일에 심고,
# fixtures/malicious-pr(설치 스크립트·시험·빌드가 모두 열쇠를 찾고 네트워크로 보내려는 코드)를 상자에서 돌린다.
# 실제 열쇠는 쓰지 않는다. 필요: docker. 사용: bash scripts/ci/sandbox-run.test.sh
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
export RUNNER_TEMP="$tmp/runner-temp"; mkdir -p "$RUNNER_TEMP"
proj="$tmp/src"; cp -a "$here/fixtures/malicious-pr" "$proj"
git -C "$proj" init -q
git -C "$proj" config http.https://github.com/.extraheader "AUTHORIZATION: basic S4FAKE-git-extraheader"
export S4_FAKE_TOKEN=S4FAKE-env-token GH_TOKEN=S4FAKE-env-gh ACTIONS_ID_TOKEN_REQUEST_TOKEN=S4FAKE-env-oidc
export S4_HOST_GITCONFIG="$tmp/host.gitconfig"; echo "[credential] helper = store S4FAKE-home" > "$S4_HOST_GITCONFIG"
before=$(find "$proj" -type f -not -path '*/.git/objects/*' -exec sha256sum {} + | sort | sha256sum)
pass=0; fail=0
ok() { pass=$((pass+1)); }; bad() { echo "FAIL: $1"; fail=$((fail+1)); }
# 대조 시험: 상자 없이 같은 코드를 돌리면 가짜 열쇠를 찾아야 한다(못 찾으면 악성 코드가 약해서 시험이 무의미)
ctl=$(cd "$proj" && node evil.mjs control 2>&1)
echo "$ctl" | grep -q 'LEAK: env S4_FAKE_TOKEN' && echo "$ctl" | grep -q 'LEAK: file .git/config' && ok || bad "대조 시험: 상자 없이도 가짜 열쇠를 못 찾음(시험 무효) — $ctl"
for phase in install test build; do
  out=$(bash "$here/sandbox-run.sh" "$phase" "$proj" 2>&1); code=$?
  [ "$code" = 0 ] || { bad "$phase 실행 실패($code): $(echo "$out" | tail -3)"; continue; }
  echo "$out" | grep -q "EVIL phase=$phase" && ok || bad "$phase: 악성 코드가 실행되지 않음(시험 무효)"
  echo "$out" | grep -q 'S4FAKE' && bad "$phase: 가짜 열쇠가 상자 안에 보임 — $(echo "$out" | grep S4FAKE | head -2)" || ok
  echo "$out" | grep -q '^LEAK:' && bad "$phase: 열쇠 후보 노출 — $(echo "$out" | grep '^LEAK:' | head -3)" || ok
  echo "$out" | grep -q 'hook=yes' && bad "$phase: 상자 밖 작업 폴더를 고침" || ok
  if [ "$phase" != install ]; then echo "$out" | grep -q 'net=blocked' && ok || bad "$phase: 네트워크가 열려 있음(밖으로 보낼 수 있음)"; fi
done
after=$(find "$proj" -type f -not -path '*/.git/objects/*' -exec sha256sum {} + | sort | sha256sum)
[ "$before" = "$after" ] && ok || bad "호스트 작업 폴더 파일이 바뀜"
bash "$here/sandbox-run.sh" evil "$proj" >/dev/null 2>&1 && bad "정해진 명령 밖(evil) 허용" || ok
SANDBOX_IMAGE='x; rm -rf /' bash "$here/sandbox-run.sh" test "$proj" >/dev/null 2>&1 && bad "이미지 이름 주입 허용" || ok
echo "sandbox-run 악성 PR 시험: 통과 $pass, 실패 $fail"
[ "$fail" = 0 ]

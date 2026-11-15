#!/usr/bin/env bash
# S4(#808): PR 코드를 '열쇠가 닿지 않는 상자' 안에서만 실행한다.
# 문제: codex-response 잡은 Claude 구독 열쇠·GitHub 쓰기 토큰·Claude 앱 토큰 발급 권한(id-token)을 가진 채 PR 코드(npm ci·npm test·node)를
#       같은 컴퓨터 사용자로 실행했다 → PR 코드가 환경변수·/proc·.git 설정에서 열쇠를 읽을 수 있었다.
# 방법: PR 파일의 사본(.git 제외)만 컨테이너에 넣고 실행한다. 컨테이너에는 환경변수를 넘기지 않고(-e로 정한 것만),
#       호스트 프로세스가 안 보이고(별도 PID 공간), 사본 외 호스트 파일이 없고, 설치(install) 외에는 네트워크도 없다.
#       사본은 매번 PR 파일로 다시 만든다(node_modules만 유지) — 컨테이너가 고친 파일이 호스트 작업 폴더로 돌아오지 않는다.
# 사용: sandbox-run.sh <install|tsc|test|build> [프로젝트 폴더, 기본 현재 폴더]
#       sandbox-run.sh py-unittest <프로젝트 폴더> <test_모듈>
#   출력은 그대로 보여 준다(사본에는 열쇠가 없으므로 출력에도 없다).
# 이 파일은 PR 사본이 아니라 기준(master) 사본으로 실행해야 한다(claude-auto.yml이 기준 커밋에서 따로 꺼내 둔다).
set -euo pipefail
cmd=${1:-}; src=$(cd "${2:-.}" && pwd)
case "$cmd" in
  install) run='npm ci --no-audit --no-fund'; net=bridge ;;  # 의존성 내려받기만 네트워크 허용(상자 안에는 열쇠가 없음)
  tsc)     run='npx tsc --noEmit';             net=none ;;
  test)    run='npm test';                     net=none ;;
  build)   run='npm run build';                net=none ;;
  # Python 시험 하나(crawler/ 아래, 모듈 이름만 — 경로·옵션 불가). 의존성 설치 없이 표준 라이브러리 시험만 돈다.
  py-unittest)
    mod=${3:-}; [[ "$mod" =~ ^test_[a-z0-9_]{1,60}$ ]] || { echo "py-unittest: 모듈 이름 형식 오류" >&2; exit 2; }
    run="cd crawler && python3 -m unittest $mod"; net=none ;;
  *) echo "사용: sandbox-run.sh <install|tsc|test|build|py-unittest> [폴더] [모듈]" >&2; exit 2 ;;
esac
image=${SANDBOX_IMAGE:-node:22-bookworm}  # git 포함(시험 일부가 git ls-files로 추적 파일 목록을 봄)
[[ "$image" =~ ^[a-z0-9./:@_-]+$ ]] || { echo "이미지 이름 형식 오류" >&2; exit 2; }
# 사본 위치는 고정(바꿀 수 없음 — 다른 폴더를 지우거나 컨테이너에 넣지 못하게)
box="${RUNNER_TEMP:-/tmp}/sbx-work"
mkdir -p "$box"
# 사본 새로 만들기: node_modules(상자 안 설치 결과)만 남기고 지운 뒤 PR 파일 복사(.git·node_modules 제외)
find "$box" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C "$src" --exclude=./.git --exclude=./node_modules -cf - . | tar -C "$box" -xf -
# 사본용 새 git 저장소(열쇠·원격·설정 없음): 시험이 'git ls-files'로 추적 파일을 본다. 호스트 git 설정은 읽지 않는다.
hostgit() { GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git -C "$box" -c core.hooksPath=/dev/null "$@"; }
hostgit init -q && hostgit add -A
if [ "$cmd" != install ] && [ "$cmd" != py-unittest ] && [ ! -d "$box/node_modules" ] && [ -f "$box/package-lock.json" ]; then
  "$0" install "$src"
fi
docker run --rm --network "$net" \
  --cap-drop ALL --security-opt no-new-privileges --pids-limit 2048 --memory 6g \
  --user "$(id -u):$(id -g)" --read-only --tmpfs /tmp:exec,size=2g \
  -e HOME=/tmp -e CI=true -e GIT_CONFIG_NOSYSTEM=1 -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
  -v "$box":/w -w /w "$image" sh -c "$run"

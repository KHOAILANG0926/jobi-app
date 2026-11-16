#!/usr/bin/env bash
# S4(#808) 3차: Claude 잡(쓰기 토큰 없음)이 끝난 뒤, Claude가 만든 결과를 게시 잡에 넘길 '데이터'로만 모은다(기준 사본으로 실행).
#   - 초안 글(.claude-out/reply.md·review.md·issues.json, 커밋 메시지 commit-message.txt)은 일반 파일만 복사(링크 거절).
#   - codex: 작업 폴더 변경을 patch로 만든다. Claude 설정 경로·액션이 기준 브랜치로 되돌린 경로·초안 폴더는 넣지 않는다(액션의 복원이 PR 쪽 파일을 되돌린 것을 커밋하지 않게).
#     같은 변경을 열쇠 없는 상자에서 tsc·시험·빌드하고, 그 결과와 트리 번호(write-tree)를 meta.json에 적는다 → 게시 잡이 같은 트리인지 대조.
# 사용: claude-collect.sh <codex|pr|issue|review> <내보낼 폴더> [기준 사본 폴더] [상자 검사 …(기본 "tsc" "test" "build")]
set -uo pipefail
mode=$1; dest=$2; T=${3:-"$RUNNER_TEMP/trusted"}; shift $(( $# < 3 ? $# : 3 ))
checks=("$@"); [ ${#checks[@]} -gt 0 ] || checks=(tsc test build)
mkdir -p "$dest"
src=.claude-out
for f in reply.md review.md issues.json commit-message.txt pr-title.txt pr.md; do
  [ -e "$src/$f" ] || continue
  if [ -L "$src/$f" ] || [ ! -f "$src/$f" ]; then echo "::error::초안 $f가 일반 파일이 아님 — 버림"; continue; fi
  head -c 200000 "$src/$f" > "$dest/$f"
done
[ "$mode" = codex ] || [ "$mode" = pr ] || exit 0
g() { GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"; }
EXCL=(':(exclude).claude' ':(exclude).claude-pr' ':(exclude).claude-out' ':(exclude).mcp.json' ':(exclude).claude.json' ':(exclude).gitmodules'
      ':(exclude).ripgreprc' ':(exclude)CLAUDE.md' ':(exclude)CLAUDE.local.md' ':(exclude).husky')
g add -A -- . "${EXCL[@]}"
g diff --cached --binary HEAD > "$dest/patch.diff"
tree=$(g write-tree)
msg=$(head -n1 "$dest/commit-message.txt" 2>/dev/null | cut -c1-200)
[ -n "$msg" ] || msg="fix: 검사 지적 반영 (Claude)"
result=실패
if [ -s "$dest/patch.diff" ]; then
  result=통과
  # 의존성 파일을 Claude가 바꿨으면 상자의 설치 결과(바꾸기 전 원본)와 맞지 않고, 바뀐 설치 스크립트를 자동으로 돌리지도 않는다 → 실패(사람 세션 몫)
  if g diff --cached --name-only HEAD | grep -qE '(^|/)(package(-lock)?\.json|\.npmrc)$'; then result=실패; echo "의존성 파일이 바뀌어 상자 검사를 하지 않음(실패로 기록)"; checks=(); fi
  # 상자 검사는 게시할 트리 그대로(write-tree 결과를 꺼낸 사본)로 한다 — 작업 폴더에는 patch에서 뺀 파일·무시 목록 파일도 있어
  # 올리는 내용과 다른 묶음으로 '통과'가 될 수 있다(독립 검토 6회 지적 2)
  exp="${RUNNER_TEMP:-/tmp}/claude-tree"; rm -rf "$exp"; mkdir -p "$exp"
  if ! g archive "$tree" | tar -C "$exp" -xf -; then result=실패; echo "트리 꺼내기 실패"; checks=(); fi
  for c in ${checks[@]+"${checks[@]}"}; do
    read -r -a cw <<<"$c"
    # 공개 로그에 검사 출력(Claude가 영향 줄 수 있는 글)을 찍지 않는다 — 실패한 검사 이름만(독립 검토 5차 지적 4)
    if ! bash "$T/scripts/ci/sandbox-run.sh" "${cw[0]}" "$exp" "${cw[@]:1}" > "$RUNNER_TEMP/check.log" 2>&1; then result=실패; echo "상자 검사 실패: ${cw[0]}"; break; fi
  done
fi
jq -n --arg tree "$tree" --arg message "$msg" --arg result "$result" '{tree:$tree, message:$message, result:$result}' > "$dest/meta.json"
echo "patch $(wc -c < "$dest/patch.diff")바이트, 상자 검사 $result"

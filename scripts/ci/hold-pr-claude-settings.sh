#!/usr/bin/env bash
# S4(#808): 열쇠 있는 잡에서 Claude를 PR 체크아웃 위에서 돌리기 전에, PR 쪽 'Claude가 자동으로 실행·적용하는 파일'을 치운다.
#   - .claude/settings.json·settings.local.json(hook = node 명령, 허용 목록), .mcp.json(MCP 서버 = 명령 실행): PR 코드다.
#   - 추적되는 심볼릭 링크: 링크로 /proc/self/environ·.git/config 같은 열쇠 파일을 Claude가 읽고 내보내게 만드는 길.
#   치운 파일은 skip-worktree로 표시해 Claude의 `git add -A`가 '삭제'로 커밋하지 않게 한다. 원본은 $RUNNER_TEMP/pr-held에 둔다.
#   Claude 출력 초안 폴더($RUNNER_TEMP/claude-out)를 새로 만든다(PR이 미리 심은 링크 파일로 열쇠를 올리는 길 차단 — 작업 폴더 밖).
# 기준(master) 사본으로 실행한다(claude-auto.yml). 사용: hold-pr-claude-settings.sh [작업 폴더, 기본 현재]
set -euo pipefail
cd "${1:-.}"
held="${RUNNER_TEMP:?}/pr-held"; mkdir -p "$held"
{ git ls-files -- .claude/settings.json .claude/settings.local.json .mcp.json; git ls-files -s | awk '$1=="120000"{print $4}'; } | sort -u | while IFS= read -r f; do
  [ -n "$f" ] || continue
  git update-index --skip-worktree -- "$f"
  mkdir -p "$held/$(dirname "$f")" && mv -- "$f" "$held/$f"
  echo "치움: $f"
done
rm -f .claude/settings.local.json .mcp.json
left=$(find . -path ./.git -prune -o -type l -print)
[ -z "$left" ] || { echo "::error::추적 안 된 링크 남음: $left"; exit 1; }
rm -rf "$RUNNER_TEMP/claude-out" && mkdir "$RUNNER_TEMP/claude-out"

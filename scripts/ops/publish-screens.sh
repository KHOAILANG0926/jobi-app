#!/usr/bin/env bash
# 'screens' 브랜치(그림 전용) 게시 한 곳(Codex #680 P1: 데모 촬영·운영 모바일 캡처가 서로 덮어쓰던 것 → 칸(폴더)별로만 바꾼다).
# 사용: publish-screens.sh <그림 폴더> <칸 이름: demo|mobile> <커밋 글>
# 칸 하나만 통째로 바꾸고 다른 칸은 그대로 둔다. 두 작업이 동시에 올려도 받아서 다시 올린다(최대 5번, 강제 덮어쓰기 없음).
# vercel.json: 이 브랜치를 Vercel이 배포하지 않게(demo-capture 기존 설정 유지).
set -euo pipefail
src=$(cd "$1" && pwd); slot="$2"; msg="$3"
repo="${SCREENS_REMOTE:-https://x-access-token:${GH_TOKEN:-}@github.com/${GITHUB_REPOSITORY:-}.git}"  # SCREENS_REMOTE: 시험용
work=$(mktemp -d)
for try in 1 2 3 4 5; do
  rm -rf "$work" && mkdir -p "$work" && cd "$work"
  if git clone -q --depth 1 --branch screens "$repo" . 2>/dev/null; then :; else git init -q -b screens && git remote add origin "$repo"; fi
  git config user.name "github-actions[bot]"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  rm -rf "./$slot" && mkdir -p "./$slot" && cp -r "$src"/. "./$slot/"
  echo '{"git":{"deploymentEnabled":false}}' > vercel.json
  git add -A && { git diff --cached --quiet && { echo "바뀐 그림 없음"; exit 0; }; git commit -qm "$msg"; }
  if git push -q origin HEAD:screens; then echo "screens/$slot 게시"; exit 0; fi
  echo "다른 작업이 먼저 올림 — 다시 받아서 올림($try)"; sleep $((try * 3))
done
echo "::error::screens 게시 실패"; exit 1

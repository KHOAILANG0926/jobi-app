#!/usr/bin/env bash
# S4(#808) 4차: Claude가 GitHub 글을 직접 가져오지 않게, 기준 사본이 '믿을 수 있는 작성자'의 글만 골라 파일로 준다(독립 검토 4차 지적 1·2·4).
#   공개 저장소라 누구나 PR·이슈에 댓글을 단다 → 그 글이 Claude에게 가면 꼬임 공격 통로. 그리고 Claude의 gh·git 명령에 ':*'(뒤에 아무 인자나)
#   허용을 두면 인자 오류 글·--output으로 열쇠가 새거나 파일이 써진다 → Claude에게는 정확한 명령만 주고, 필요한 글·기록은 여기서 미리 만든다.
# 믿는 작성자: Codex 검사관 봇, claude[bot](첫 줄이 검토·답 표시 — 게시 단계가 검증해 단 글), 저장소 주인·협업자(author_association OWNER/MEMBER/COLLABORATOR)의 사람 계정.
# 사용: claude-inputs.sh codex <PR 번호> <폴더>   → findings.json(리뷰·줄 지적·요약 댓글), history.txt(바뀐 파일의 최근 git 기록)
#       claude-inputs.sh issue <번호> <폴더>      → thread.json(본문·댓글), status.md(status 브랜치 STATUS.md), open-prs.json
set -euo pipefail
mode=$1; num=$2; out=$3
[[ "$num" =~ ^[0-9]+$ ]] || { echo "번호 형식 오류" >&2; exit 2; }
repo=${GITHUB_REPOSITORY:?}
mkdir -p "$out"
trusted='(.user.login == "chatgpt-codex-connector[bot]")
  or (.user.login == "claude[bot]" and ((.body // "") | (startswith("<!-- claude-fallback-review -->") or startswith("<!-- claude-codex-reply -->") or startswith("<!-- claude-issue-reply -->"))))
  or (.user.type == "User" and ((.author_association // "") | IN("OWNER","MEMBER","COLLABORATOR")))'
pick() { jq -c "[.[] | select($trusted) | {author: .user.login, at: (.submitted_at // .created_at), path: (.path // null), line: (.line // null), state: (.state // null), body: ((.body // \"\") | .[0:20000])}]"; }
case "$mode" in
  codex)
    {
      echo '{"reviews":'; gh api --paginate "repos/$repo/pulls/$num/reviews?per_page=100" | jq -s 'add' | pick
      echo ',"line_comments":'; gh api --paginate "repos/$repo/pulls/$num/comments?per_page=100" | jq -s 'add' | pick
      echo ',"comments":'; gh api --paginate "repos/$repo/issues/$num/comments?per_page=100" | jq -s 'add' | pick
      echo '}'
    } | jq . > "$out/findings.json"
    gh api --paginate "repos/$repo/pulls/$num/files?per_page=100" --jq '.[].filename' | head -60 | while IFS= read -r f; do
      [ -e "$f" ] || continue
      echo "=== $f"; GIT_CONFIG_GLOBAL=/dev/null git -c core.hooksPath=/dev/null log -p -5 --no-ext-diff --no-textconv -- "$f" | head -400
    done > "$out/history.txt"
    ;;
  issue)
    issue=$(gh api "repos/$repo/issues/$num")
    {
      echo '{"issue":'; jq -c "[. ] | [.[] | select($trusted) | {author: .user.login, title, body: ((.body // \"\") | .[0:20000])}]" <<<"$issue"
      echo ',"comments":'; gh api --paginate "repos/$repo/issues/$num/comments?per_page=100" | jq -s 'add' | pick
      echo '}'
    } | jq . > "$out/thread.json"
    git show origin/status:STATUS.md > "$out/status.md" 2>/dev/null || echo "(status 브랜치 없음)" > "$out/status.md"
    gh pr list -R "$repo" --state open --limit 30 --json number,title,headRefName,isDraft,author > "$out/open-prs.json" || echo '[]' > "$out/open-prs.json"
    ;;
  *) echo "모드는 codex|issue" >&2; exit 2 ;;
esac
echo "Claude 입력 준비: $(ls "$out" | tr '\n' ' ')"

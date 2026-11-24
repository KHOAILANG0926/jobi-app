#!/usr/bin/env bash
# Codex 무응답 감지(Lee 2026-11-24): 봇(viecganban-bot) PR이 Ready 된 뒤 15분 안에 chatgpt-codex-connector[bot]의
# 리뷰·줄 댓글·댓글·반응(👀·👍)이 하나도 없으면 'codex-silent' 라벨 + 쉬운 말 댓글 1번(Lee 멘션 — deploy-notify.sh와 같은 방식).
# 병합 조건이 아니다(Codex 검토는 선택, Lee 2026-11-21): 이 스크립트는 병합을 막지 않고, 조회 실패는 알림 없이 넘긴다(거짓 경보 방지).
# Draft는 Codex가 검토하지 않으므로 기준 시각 = 마지막 ready_for_review 시각(없으면 PR 생성 시각).
# 아직 15분 전이면 남은 분(+1)을 CODEX_WAIT_FILE에 적어 기존 codex-wait-timer 경로가 그때 봇을 다시 부르게 한다(새 타이머 없음).
# 사용: codex-silent.sh <PR 번호> <작성자>   환경: GH_TOKEN, REPO, CODEX_WAIT_FILE
set -uo pipefail
NUM="${1:?PR 번호}"; AUTHOR="${2:-}"
LIMIT=15
CODEX='chatgpt-codex-connector[bot]'
OWNER="${REPO%%/*}"
[ "$AUTHOR" = viecganban-bot ] || exit 0
MARK='<!-- codex-silent -->'

issue=$(gh api "repos/$REPO/issues/$NUM") || { echo "::warning::PR #$NUM Codex 무응답 확인: 조회 실패 — 건너뜀"; exit 0; }
echo "$issue" | jq -e 'any(.labels[]?; .name == "codex-silent")' >/dev/null && exit 0

# Codex 흔적: 리뷰·줄 댓글·일반 댓글·반응 중 하나라도 있으면 응답한 것(내용 무관)
seen=0
for path in "pulls/$NUM/reviews" "pulls/$NUM/comments" "issues/$NUM/comments" "issues/$NUM/reactions"; do
  data=$(gh api "repos/$REPO/$path?per_page=100" --paginate --slurp | jq 'add // []') || { echo "::warning::PR #$NUM Codex 무응답 확인: $path 조회 실패 — 건너뜀"; exit 0; }
  if echo "$data" | jq -e --arg c "$CODEX" 'any(.[]; .user.login == $c)' >/dev/null; then seen=1; break; fi
done
[ "$seen" = 0 ] || exit 0

pr=$(gh api "repos/$REPO/pulls/$NUM") || { echo "::warning::PR #$NUM Codex 무응답 확인: PR 조회 실패 — 건너뜀"; exit 0; }
[ "$(echo "$pr" | jq -r '.draft')" = false ] || exit 0
events=$(gh api "repos/$REPO/issues/$NUM/events?per_page=100" --paginate --slurp | jq 'add // []') || { echo "::warning::PR #$NUM Codex 무응답 확인: 이벤트 조회 실패 — 건너뜀"; exit 0; }
since=$(jq -rn --argjson e "$events" --arg created "$(echo "$pr" | jq -r '.created_at // ""')" '([$e[] | select(.event == "ready_for_review") | .created_at] | max) // $created')
case "$since" in 20??-??-??T*) ;; *) echo "::warning::PR #$NUM Codex 무응답 확인: 기준 시각 없음 — 건너뜀"; exit 0 ;; esac
age=$(( ($(date -u +%s) - $(date -u -d "$since" +%s)) / 60 ))

if [ "$age" -lt "$LIMIT" ]; then
  echo "::notice::PR #$NUM Codex 반응 아직 없음(Ready 후 ${age}분) — $((LIMIT - age + 1))분 뒤 다시 확인"
  [ -z "${CODEX_WAIT_FILE:-}" ] || echo "$((LIMIT - age + 1))" >> "$CODEX_WAIT_FILE"
  exit 0
fi

gh api -X POST "repos/$REPO/issues/$NUM/labels" -f 'labels[]=codex-silent' >/dev/null || { echo "::warning::PR #$NUM codex-silent 라벨 실패"; exit 0; }
gh api -X POST "repos/$REPO/issues/$NUM/comments" -f body="$MARK
@$OWNER Codex 자동 검토가 이 PR에 ${LIMIT}분 넘게 아무 반응이 없습니다(리뷰·댓글·👀 모두 없음, 기준: Ready 전환 후 ${age}분). Codex 설정(자동 검토)이나 연결을 확인해 주세요.
이것은 알림일 뿐 병합 조건이 아닙니다 — 필수 검사와 승인 절차는 그대로 진행됩니다." >/dev/null || echo "::warning::PR #$NUM codex-silent 댓글 실패"
echo "- PR #$NUM codex-silent: Ready 후 ${age}분 Codex 무응답 — 라벨·알림 댓글" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 0

#!/usr/bin/env bash
# #1004(Lee 2026-11-24): 운영 검사 결과를 Lee가 묻기 전에 알린다 — 새 알림 장치 없이 deploy-verify.yml이 이미 하던 일(실패 이슈)과
# 그 PR의 기존 승인 요청 댓글 자리에 GitHub 멘션 알림을 얹는다.
#   success : 병합 PR에 '완료'(병합·운영 배포·실제 화면 검사 통과) 댓글 1번. 같은 커밋 표시가 이미 있으면 안 남긴다(재실행·중복 방지).
#             Lee 승인을 요청했던 PR에만 Lee를 멘션한다(자동 병합 PR마다 멘션하지 않음 — 정상 진행 중 알림 없음).
#   failure : '운영 배포 검증 실패: <7자리>' 이슈(S6 병합 잠금이 이 제목을 읽음 — 제목 형식 그대로)를 이미 열린 같은 제목이 없을 때만 만든다.
#             본문에 실패 단계·실행 기록 링크·필요한 조치를 적고 Lee를 멘션한다. 이슈를 못 찾는 조회 실패는 알림 누락이 더 나빠 그대로 만든다.
# GitHub 댓글·이슈 생성은 '발송'이다. Lee 단말에서의 수신은 GitHub 알림 설정에 달려 있어 여기서 확인할 수 없다(멘션은 GitHub이 알림을 만드는 표준 방법).
# 알림 실패는 운영 검사 결과를 바꾸지 않는다(경고만). 필요한 환경: GH_TOKEN, REPO, SHA, RUN_ID, GITHUB_SERVER_URL, GITHUB_STEP_SUMMARY(선택)
set -uo pipefail
MODE="${1:-}"
OWNER="${REPO%%/*}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${RUN_ID:-0}"
say() { echo "$1"; echo "- 알림: $1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

case "$MODE" in
success)
  # 운영 검사가 성공했으니 열려 있던 '운영 배포 검증 실패' 잠금 이슈가 이제 풀렸는지 대기 중인 PR이 알 수 있어야 한다(2026-11-26: 잠금은 이 성공 커밋이 실패 커밋을 포함하면 이슈를 닫지 않아도 풀리지만,
  # 대기 PR의 approval-gate 판정은 다음 이벤트가 있어야 다시 계산돼 한참 멈춰 있었다). 새 장치 없이 기존 둘을 부른다: approval-checks 전체 재판정 1번 + 기존 다시 확인 타이머(6분 뒤 봇 병합).
  # 잠금 이슈가 열려 있을 때만(성공마다 부르지 않음). 호출 실패는 경고만 — 운영 검사 결과·이 알림은 그대로(다음 이벤트·예약 실행이 다시 봄).
  if locks=$(gh api "repos/$REPO/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100" --paginate --slurp | jq 'add // [] | [.[] | select((.pull_request | not) and .user.login == "github-actions[bot]" and (.title // "" | test("^운영 배포 검증 실패: [0-9a-f]{7,40}")))] | length'); then
    if [ "${locks:-0}" -gt 0 ]; then
      if gh workflow run approval-checks.yml --repo "$REPO" --ref master >/dev/null 2>&1 && gh workflow run codex-wait-timer.yml --repo "$REPO" --ref master -f minutes=6 >/dev/null 2>&1; then
        say "잠금 이슈 ${locks}건이 열려 있어 병합 조건 판정 재계산 + 6분 뒤 봇 병합 재확인을 예약함"
      else echo "::warning::잠금 해제 반영 호출 실패"; say "잠금 이슈 ${locks}건 — 판정 재계산·재확인 호출 실패(다음 이벤트·예약 실행이 반영)"; fi
    fi
  else say "열린 이슈 조회 실패 — 잠금 해제 반영 호출 생략"; fi
  pr=$(gh api "repos/$REPO/commits/$SHA/pulls" | jq -r '[.[] | select(.merged_at != null)][0].number // empty') || { say "병합 PR 조회 실패 — 완료 알림 생략"; exit 0; }
  [ -n "$pr" ] || { say "이 커밋(${SHA:0:7})은 PR 없는 직접 반영 — 완료 알림 생략"; exit 0; }
  comments=$(gh api "repos/$REPO/issues/$pr/comments?per_page=100" --paginate --slurp | jq 'add // []') || { say "PR #$pr 댓글 조회 실패 — 완료 알림 생략(중복 방지 확인 불가)"; exit 0; }
  mark="<!-- deploy-verify-done:$SHA -->"
  if echo "$comments" | jq -e --arg m "$mark" 'any(.[]; .user.login == "github-actions[bot]" and ((.body // "") | startswith($m)))' >/dev/null; then
    say "PR #$pr에 커밋 ${SHA:0:7} 완료 알림이 이미 있음 — 다시 남기지 않음"; exit 0
  fi
  who=""
  if echo "$comments" | jq -e 'any(.[]; .user.login == "github-actions[bot]" and ((.body // "") | startswith("<!-- decision-approval-request -->")))' >/dev/null; then who="@$OWNER "; fi
  body="$mark
${who}✅ 완료: 커밋 ${SHA:0:7} 병합·운영 배포·실제 화면 검사 통과. 운영 주소 https://viecganban.vn · 확인 실행: $RUN_URL"
  if gh api -X POST "repos/$REPO/issues/$pr/comments" -f body="$body" >/dev/null; then say "PR #$pr에 완료 알림 발송(${SHA:0:7})"
  else echo "::warning::PR #$pr 완료 알림 댓글 실패"; say "PR #$pr 완료 알림 발송 실패 — 운영 검사 결과는 그대로 성공"; fi
  ;;
failure)
  title="운영 배포 검증 실패: ${SHA:0:7}"
  existing=""
  if issues=$(gh api "repos/$REPO/issues?state=open&per_page=100" --paginate --slurp | jq 'add // []'); then
    existing=$(echo "$issues" | jq -r --arg t "$title" '[.[] | select((.pull_request | not) and .title == $t)][0].number // empty')
  else
    say "열린 이슈 조회 실패 — 알림 누락을 피하려고 중복 확인 없이 이슈를 만듦"
  fi
  [ -z "$existing" ] || { say "같은 제목의 열린 이슈 #$existing 있음 — 새 이슈·알림을 다시 만들지 않음"; exit 0; }
  step=$(gh api "repos/$REPO/actions/runs/${RUN_ID:-0}/jobs" 2>/dev/null | jq -r '[.jobs[]?.steps[]? | select(.conclusion == "failure") | .name][0] // empty') || step=""
  [ -n "$step" ] || step="확인하지 못함(실행 기록에서 확인)"
  printf '%s\n' "커밋 $SHA 의 운영 배포 확인 또는 실제 화면 검사가 실패했습니다." \
    "@$OWNER 조치 필요 — 실패 단계: $step" \
    "실행 기록: $RUN_URL" \
    "이 커밋 작업은 완료로 보고하지 않습니다(배포 강제 규칙 DR6)." \
    "" \
    "필요한 조치: ① 실행 기록의 실패 단계 로그 확인 ② 일시 오류로 보이면 실행 기록 화면의 Re-run failed jobs ③ 코드 원인이면 수정 PR. 이 커밋을 포함한 master에서 deploy-verify가 성공(재실행 포함)하거나 이 이슈를 닫으면 일반 PR 자동 병합 잠금(S6)이 풀립니다. 운영 되돌리기(rollback)는 Lee 승인 뒤에만 합니다." > body.md
  if gh issue create --title "$title" --body-file body.md >/dev/null; then say "실패 이슈 발송: $title (실패 단계: $step)"
  else echo "::error::운영 배포 검증 실패 이슈 생성 실패 — 실행 기록을 직접 확인해야 함"; say "실패 이슈 생성 실패 — 이 실행이 빨간색인 것이 유일한 표시"; fi
  ;;
*) echo "사용법: deploy-notify.sh success|failure" >&2; exit 2 ;;
esac
exit 0

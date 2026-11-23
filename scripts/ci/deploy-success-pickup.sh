#!/usr/bin/env bash
# 운영 검사 성공 뒤 다음 작업 1건 착수(Lee 2026-11-24 1순위 3번). deploy-verify.yml 마지막 단계(앞 단계가 모두 성공했을 때만)가 부른다.
# 병합 성공만으로는 부르지 않는다 — 운영 배포 READY + 실제 화면 검사가 이 커밋에서 성공한 뒤에만 여기까지 온다.
# 새 작업 큐를 만들지 않는다: 기존 claude-auto.yml task-pickup(ai-task 이슈 중 가장 오래된 1건·ai-task-running 중복 방지)을 pickup=true로 부르기만 한다.
# 성공 1건당 최대 1번만 부른다(중복 이벤트·재실행 방지):
#   ① 같은 실행의 재실행(run_attempt>1)이면 안 부른다
#   ② 같은 커밋의 deploy-verify가 이미 성공한 적 있으면(다른 실행) 안 부른다 — 그 성공이 이미 불렀다
#   ③ 이 커밋이 지금 master 맨 위가 아니면 안 부른다 — 뒤 커밋의 운영 검사가 판단한다(옛 성공으로 다음 작업을 열지 않음)
# 조회 실패는 부르지 않는 쪽(닫힌 방향)이며, 이유를 실행 요약에 남긴다. 운영 검사 자체의 결과(성공)는 바꾸지 않는다.
# 필요한 환경: GH_TOKEN, REPO, SHA, RUN_ID, RUN_ATTEMPT, GITHUB_STEP_SUMMARY
set -uo pipefail
say() { echo "$1"; echo "- 다음 작업 연결: $1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
[ "${RUN_ATTEMPT:-1}" = 1 ] || { say "재실행(${RUN_ATTEMPT}회차)이라 부르지 않음(첫 실행이 이미 판단함)"; exit 0; }
prior=$(gh api "repos/$REPO/actions/workflows/deploy-verify.yml/runs?head_sha=$SHA&status=success&per_page=100" --jq "[.workflow_runs[] | select(.id != $RUN_ID)] | length") \
  || { say "같은 커밋의 이전 성공 조회 실패 — 부르지 않음"; exit 0; }
[ "$prior" = 0 ] || { say "커밋 ${SHA:0:7}의 운영 검사가 이미 ${prior}번 성공함 — 그때 이미 판단했으므로 부르지 않음"; exit 0; }
head=$(gh api "repos/$REPO/commits/master" --jq .sha) || { say "master 맨 위 조회 실패 — 부르지 않음"; exit 0; }
[ "$head" = "$SHA" ] || { say "master 맨 위(${head:0:7})가 이 커밋(${SHA:0:7})이 아님 — 뒤 커밋의 운영 검사가 판단"; exit 0; }
if gh workflow run claude-auto.yml --repo "$REPO" --ref master -f pickup=true -f pickup_reason="운영 검사 성공 커밋 ${SHA:0:7} (deploy-verify 실행 $RUN_ID)"; then
  say "운영 검사 성공(${SHA:0:7}) → 작업 큐(task-pickup) 1회 호출"
else
  echo "::error::작업 큐(task-pickup) 호출 실패"; say "작업 큐 호출 실패 — 다음 운영 검사 성공 또는 3시간 예약 실행이 다시 집음"; exit 1
fi

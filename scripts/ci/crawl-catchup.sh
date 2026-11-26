#!/usr/bin/env bash
# 정기 수집 예약이 GitHub에서 빠지거나 늦을 때의 보충(#1071 A안, Lee 2026-11-26).
# deploy-verify.yml 마지막 단계(운영 검사가 모두 성공했을 때만)가 부른다. 새 서버·새 열쇠 없음 — 기존 crawl.yml 수동 실행 경로만 쓴다.
# 부르는 조건: 최근 N시간(기본 10) 안에 수집 보관물(vieclam24h-details)이 없고, crawl.yml 실행이 진행·대기 중이 아닐 때 1번.
# 부르는 값은 dry_run=true·keep_for_save=true 고정 — 수집·원문 보관만, DB 저장 잡(save·verify-save)은 돌지 않는다(정기 DB 저장 중단 유지).
# 목록 위치(오프셋)는 UTC 12시 전 0, 이후 10 — 예약(02:23→0, 08:23→10)과 같은 앞 10건/다음 10건을 번갈아 받는다.
# 조회·호출 실패는 부르지 않고 이유만 남기며 항상 exit 0(운영 검사 결과를 바꾸지 않음 — 실패하면 S6 잠금 이슈가 생기므로).
# 필요한 환경: GH_TOKEN, REPO, GITHUB_STEP_SUMMARY (선택: CATCHUP_HOURS, NOW_HOUR_UTC)
set -uo pipefail
say() { echo "$1"; echo "- 정기 수집 보충: $1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
HOURS="${CATCHUP_HOURS:-10}"
arts=$(gh api "repos/$REPO/actions/artifacts?name=vieclam24h-details&per_page=5") || { say "수집 보관물 조회 실패 — 부르지 않음"; exit 0; }
recent=$(jq --argjson h "$HOURS" '[.artifacts[] | select(.expired == false) | select((now - (.created_at | fromdateiso8601)) < $h * 3600)] | length' <<<"$arts") || { say "보관물 해석 실패 — 부르지 않음"; exit 0; }
[ "$recent" = 0 ] || { say "최근 ${HOURS}시간 안에 수집 보관물 ${recent}개 있음 — 부르지 않음"; exit 0; }
runs=$(gh api "repos/$REPO/actions/workflows/crawl.yml/runs?per_page=20") || { say "crawl.yml 실행 조회 실패 — 부르지 않음"; exit 0; }
busy=$(jq '[.workflow_runs[] | select(.status != "completed")] | length' <<<"$runs") || { say "실행 해석 실패 — 부르지 않음"; exit 0; }
[ "$busy" = 0 ] || { say "crawl.yml 실행이 이미 진행·대기 중(${busy}개) — 부르지 않음"; exit 0; }
hour="${NOW_HOUR_UTC:-$(date -u +%-H)}"
if [ "$hour" -lt 12 ]; then off=0; else off=10; fi
if gh workflow run crawl.yml --repo "$REPO" --ref master -f dry_run=true -f sample_limit=10 -f keep_for_save=true -f sample_offset="$off"; then
  say "최근 ${HOURS}시간 수집 없음 → crawl.yml 1회 호출(목록 위치 ${off}, 수집·보관만 — DB 저장 안 함)"
else
  say "crawl.yml 호출 실패 — 다음 운영 검사 성공 때 다시 판단"
fi
exit 0

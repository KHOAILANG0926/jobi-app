#!/usr/bin/env bash
# 정기 수집 예약이 GitHub에서 빠지거나 늦을 때의 보충(#1071 A안, Lee 2026-11-26).
# deploy-verify.yml 마지막 단계(운영 검사가 모두 성공했을 때만)가 부른다. 새 서버·새 열쇠 없음 — 기존 crawl.yml 수동 실행 경로만 쓴다.
# 자리(슬롯)는 예약과 똑같다: 목록 위치 0 = 02:23 UTC 예약, 목록 위치 10 = 08:23 UTC 예약(crawl.yml). 판정은 crawl-slot.sh 한 곳.
#  - 예약 시각 + 유예(기본 120분)가 지났는데 오늘 그 자리가 비어 있을 때만, 그 자리의 목록 위치로 crawl.yml을 1회 부른다(한 번에 최대 1자리).
#  - 오늘 자리가 이미 찼으면(예약이 늦게라도 돌았거나, 진행·대기 중이거나, 앞선 보충이 돌았거나) 부르지 않는다 → 정기+보충 합쳐 하루 20건(2자리×10건) 상한.
#  - 보충이 부른 실행도, 그 뒤 늦게 도는 예약 실행도 crawl.yml의 slot 단계가 같은 판정으로 겹치면 건너뛴다(중복 수집 없음).
# 부르는 값은 dry_run=true·keep_for_save=true 고정 — 수집·원문 보관만, DB 저장 잡(save·verify-save)은 돌지 않는다(정기 DB 저장 중단 유지).
# 조회·호출 실패는 부르지 않고 이유만 남기며 항상 exit 0(운영 검사 결과를 바꾸지 않음 — 실패하면 S6 잠금 이슈가 생기므로).
# 필요한 환경: GH_TOKEN, REPO, GITHUB_STEP_SUMMARY (선택: NOW_UTC, CATCHUP_GRACE_MIN)
set -uo pipefail
say() { echo "$1"; echo "- 정기 수집 보충: $1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
now="${NOW_UTC:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"; today="${now%%T*}"
now_s=$(date -u -d "$now" +%s) || { say "현재 시각 해석 실패 — 부르지 않음"; exit 0; }
grace=$(( ${CATCHUP_GRACE_MIN:-120} * 60 ))
SLOTS=("0 02:23" "10 08:23")   # crawl.yml 예약(cron '23 2'·'23 8', UTC)과 같은 값 — crawler/test_scheduled_cli.py가 일치를 지킨다
for slot in "${SLOTS[@]}"; do
  off="${slot%% *}"; hm="${slot##* }"
  due_s=$(date -u -d "${today}T${hm}:00Z" +%s) || { say "예약 시각 해석 실패 — 부르지 않음"; exit 0; }
  [ "$now_s" -ge $(( due_s + grace )) ] || { echo "목록 위치 ${off}: 예약(${hm} UTC)+유예 전 — 보지 않음"; continue; }
  msg=$(CRAWL_SLOT_ME=0 TODAY_UTC="$today" bash "$(dirname "$0")/crawl-slot.sh" taken "$off"); rc=$?
  case "$rc" in
    0) echo "$msg"; continue ;;
    1) ;;
    *) say "오늘 수집 기록 조회 실패 — 부르지 않음"; exit 0 ;;
  esac
  if gh workflow run crawl.yml --repo "$REPO" --ref master -f dry_run=true -f sample_limit=10 -f keep_for_save=true -f sample_offset="$off"; then
    say "오늘 목록 위치 ${off} 자리가 비어 있음(예약 ${hm} UTC 지남) → crawl.yml 1회 호출(수집·보관만 — DB 저장 안 함)"
  else
    say "crawl.yml 호출 실패 — 다음 운영 검사 성공 때 다시 판단"
  fi
  exit 0
done
say "오늘 지난 예약 자리가 모두 찼거나 아직 때가 아님 — 부르지 않음(하루 20건 상한)"
exit 0

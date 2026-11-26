#!/usr/bin/env bash
# 정기 수집의 '자리(슬롯)' 판정 한 곳 — 정기 예약·보충 호출이 같은 기준으로 하루 20건 상한을 지킨다(#1071, Lee 2026-11-26).
# 하루(UTC 날짜) 자리는 둘: 목록 위치 0(앞 10건, 예약 02:23 UTC)·목록 위치 10(그다음 10건, 예약 08:23 UTC). 자리마다 하루 최대 1번.
# 사용: crawl-slot.sh taken <0|10>   종료 0 = 이미 찬 자리(이유 출력) / 1 = 빈 자리 / 2 = 조회 실패(부른 쪽이 정함)
# 찬 자리 = 오늘 만든 crawl.yml 실행 중 제목이 '목록 위치 <N> · 10건'이고(crawl.yml run-name) 성공했거나 아직 진행·대기 중인 다른 실행.
#  - 진행·대기 중 실행은 번호가 앞선 것만 센다(CRAWL_SLOT_ME가 내 실행 번호, 없으면 0 = 모든 진행 중 실행) — 동시에 시작한 두 실행이 서로를 보고 둘 다 건너뛰지 않게.
#  - 10건이 아닌 시험 실행(sample_limit 1~9)·검증 저장 실행은 제목이 달라 세지 않는다.
# 필요한 환경: GH_TOKEN, REPO (선택: CRAWL_SLOT_ME, TODAY_UTC)
set -uo pipefail
cmd="${1:-}"; off="${2:-}"
{ [ "$cmd" = taken ] && [[ "$off" =~ ^(0|10)$ ]]; } || { echo "usage: crawl-slot.sh taken <0|10>" >&2; exit 64; }
today="${TODAY_UTC:-$(date -u +%F)}"
runs=$(gh api "repos/$REPO/actions/workflows/crawl.yml/runs?per_page=50") || exit 2
hit=$(jq -r --arg d "$today" --arg t "목록 위치 ${off} · 10건" --argjson me "${CRAWL_SLOT_ME:-0}" '
  [.workflow_runs[]
   | select(.created_at | startswith($d))
   | select(.id != $me)
   | select((.display_title // "") | contains($t))
   | select(.conclusion == "success" or (.status != "completed" and ($me == 0 or .id < $me)))
  ] | first | if . then "\(.id) (\(.status)/\(.conclusion // "-"))" else empty end' <<<"$runs") || exit 2
[ -n "$hit" ] || exit 1
echo "목록 위치 ${off}은 오늘(${today}) 이미 수집됨 — 실행 ${hit}"
exit 0

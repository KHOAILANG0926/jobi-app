#!/usr/bin/env bash
# 봇 자동병합이 읽는 "이 커밋의 check-run 목록"을 가져와 줄인다(#728 S1). 봇 워크플로와 검증이 같은 코드를 쓴다.
# 사용: fetch-check-runs.sh <owner/repo> <sha> [per_page=100]
# 실패는 반드시 비정상 종료(pipefail): gh 호출 실패·네트워크 오류·인증 오류·없는 커밋이면 이 스크립트가 0이 아닌 코드로 끝나고,
# 호출한 쪽(봇)은 병합을 건너뛴다. 조회가 잘렸으면(받은 개수 < total_count) 출력에 __incomplete__ 실패가 들어가 판정이 병합을 막는다.
set -euo pipefail
repo="${1:?owner/repo}"; sha="${2:?sha}"; per="${3:-100}"
here="$(cd "$(dirname "$0")" && pwd)"
gh api --paginate --slurp "repos/${repo}/commits/${sha}/check-runs?per_page=${per}" | jq -c -f "${here}/collapse-check-runs.jq"

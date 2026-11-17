#!/usr/bin/env bash
# master 커밋이 병합된 PR에서 온 것인지 확인한다(unmerged-work-alert.yml direct-master-push).
# 잘못된 경보 원인(2026-11-16 확인, #849·#845·#844·#830·#827·#802·#722): 병합 4~5초 뒤 검사가 돌면
# GitHub의 commit→PR 연결(commits/{sha}/pulls)이 아직 비어 있다. 그래서 한 번 보고 끝내지 않고 연결이 생길 때까지 다시 본다.
# 종료: 0 = 병합 PR 연결 확인 / 3 = 끝까지 연결 없음(경보 대상) / 그 밖 = 조회 오류(경보하지 않고 실패로 남김)
# 환경변수: REPO, SHA, (선택) ATTEMPTS(기본 10), WAIT_SECONDS(기본 30)
set -uo pipefail
attempts=${ATTEMPTS:-10}; wait=${WAIT_SECONDS:-30}
for i in $(seq 1 "$attempts"); do
  if ! prs=$(gh api "repos/$REPO/commits/$SHA/pulls" -H "Accept: application/vnd.github+json"); then echo "commit→PR 조회 실패($i/$attempts)" >&2; exit 2; fi
  if printf '%s' "$prs" | jq -e 'any(.[]; .merged_at != null and .base.ref == "master" and .merge_commit_sha == env.SHA)' >/dev/null; then
    echo "병합 PR 연결 확인($i/$attempts): $(printf '%s' "$prs" | jq -r '[.[]|select(.merge_commit_sha==env.SHA)|"#\(.number)"]|join(",")')"
    exit 0
  fi
  [ "$i" -lt "$attempts" ] && sleep "$wait"
done
echo "병합 PR 연결 없음($attempts번 확인)"
exit 3

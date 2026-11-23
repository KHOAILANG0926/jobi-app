# 병합 조건 검사(approval-gate) 대기 재확인의 기준 시각(Lee 2026-11-24 1순위: 재확인은 60분 상한).
# 입력 = 이 PR의 리뷰 목록(reviews.json), --arg sha = head 커밋, --arg head = head 커밋 시각(ISO, 못 읽었으면 빈 글자).
# 출력 = head 커밋 시각과 '이 커밋'에 대한 최신 리뷰 시각 중 늦은 것(ISO). 둘 다 없으면 빈 줄 → 봇은 재확인을 예약하지 않는다(닫힌 방향).
#   리뷰 시각을 함께 보는 이유: 오래된 커밋에 Lee가 방금 Approve하면 approval-gate가 몇 분 늦게 바뀐다(#920·#925) — 그 몇 분은 기다려야 한다.
#   다른 커밋에 대한 리뷰는 세지 않는다(그 커밋 판정과 무관).
[$head, ((if type == "array" then . else [] end)[] | select(.commit_id == $sha) | (.submitted_at // ""))]
| map(select(type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T")))
| max // ""

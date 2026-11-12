# 봇 자동병합이 보는 check-run 목록(#728 S1). 입력 = `gh api commits/<sha>/check-runs` 응답 전체.
# 같은 이름의 검사를 "이름당 마지막 1개"로 줄이면, 이름이 같은 서로 다른 워크플로의 잡(예: pr-checks의 `checks`와
# approved-layout-guard의 항상 초록인 `checks`) 중 시작이 늦은 쪽만 남아 빨간 검사가 가려진다(실행 순서 경쟁).
# 다시 돌린 검사(같은 실행 묶음 check_suite의 같은 이름)만 최신 1개로 줄이고, 다른 묶음의 같은 이름은 모두 남긴다.
.check_runs
| sort_by(.started_at)
| group_by(.name + "|" + ((.check_suite.id // 0) | tostring))
| map(last)
| map({name, conclusion, status})

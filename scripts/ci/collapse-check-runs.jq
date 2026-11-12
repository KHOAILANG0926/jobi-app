# 봇 자동병합이 보는 check-run 목록(#728 S1). 입력 = `gh api --paginate --slurp commits/<sha>/check-runs?per_page=100` 응답(페이지 배열)
# 또는 한 페이지짜리 응답 객체. 페이지가 여러 개여도 전부 합친다.
# ① 같은 이름의 검사를 "이름당 마지막 1개"로 줄이면, 이름이 같은 서로 다른 워크플로의 잡(예: pr-checks의 `checks`와
#    approved-layout-guard의 항상 초록인 `checks`) 중 시작이 늦은 쪽만 남아 빨간 검사가 가려진다(실행 순서 경쟁).
#    다시 돌린 검사(같은 실행 묶음 check_suite의 같은 이름)만 최신 1개로 줄이고, 다른 묶음의 같은 이름은 모두 남긴다.
# ② GitHub가 알려 준 전체 개수(total_count)보다 실제로 받은 개수가 적으면(조회가 잘렸으면) 가짜 실패 항목 `__incomplete__`를 더해
#    required-checks-pass.jq가 병합을 막게 한다(뒤 페이지의 실패가 안 보이는 채로 통과하지 않게).
(if type == "array" then . else [.] end) as $pages
| ($pages | map(.check_runs // []) | add // []) as $runs
| ($pages | map(.total_count // 0) | max // 0) as $total
| ($runs
   | sort_by(.started_at)
   | group_by(.name + "|" + ((.check_suite.id // 0) | tostring))
   | map(last)
   | map({name, conclusion, status})) as $collapsed
| $collapsed + (if ($runs | length) < $total then [{name: "__incomplete__", conclusion: "failure", status: "completed"}] else [] end)

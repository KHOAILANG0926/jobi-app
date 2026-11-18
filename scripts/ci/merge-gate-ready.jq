# 봇 병합 직전 판정(S8, #808): 저장소 필수 검사 중 병합 조건 검사(approval-checks.yml이 검사 전용 앱으로 올리는 ai-review·approval-gate).
# 입력 = `gh api --paginate --slurp commits/<sha>/check-runs?per_page=100` 응답(페이지 배열) 또는 한 페이지 객체 — collapse-check-runs.jq와 같은 입력.
# 출력 = "ok"(둘 다 최신이 성공) | "pending"(실행 중·아직 없음·조회 잘림 → 곧 바뀜) | "blocked"(Lee 승인 대기·실패 → 이벤트가 다시 부름).
# 이름당 최신 1개(started_at) 규칙은 collapse-check-runs.jq와 같다. 다른 앱(PR 브랜치 워크플로)이 만든 같은 이름 검사는 세지 않는다.
(if type == "array" then . else [.] end) as $pages
| ($pages | map(.check_runs // []) | add // []) as $runs
| ($pages | map(.total_count // 0) | max // 0) as $total
| ($runs | map(select(.app.slug == "viecganban-checks" and (.name == "ai-review" or .name == "approval-gate")))
   | sort_by(.started_at) | group_by(.name) | map(last)) as $g
| if ($runs | length) < $total then "pending"
  elif ($g | length) == 2 and all($g[]; .status == "completed" and .conclusion == "success") then "ok"
  elif ($g | length) < 2 or any($g[]; .status != "completed") then "pending"
  else "blocked" end

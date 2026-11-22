# 봇 병합 직전 판정(S8, #808): 저장소 필수 검사 중 병합 조건 검사(approval-checks.yml이 검사 전용 앱으로 올리는 approval-gate).
# ai-review(독립 검토) 검사는 Lee 2026-11-21 병합 조건·Ruleset에서 빠진 뒤 지웠다 — 여기서는 approval-gate만 본다.
# 입력 = `gh api --paginate --slurp commits/<sha>/check-runs?per_page=100` 응답(페이지 배열) 또는 한 페이지 객체 — collapse-check-runs.jq와 같은 입력.
# 출력 = "ok"(최신 approval-gate가 성공) | "pending"(실행 중·아직 없음·조회 잘림·action_required → 곧 바뀜) | "blocked"(실패 등 → 다시 안 부름).
# action_required를 pending으로 보는 이유: 봇은 이 판정 앞에서 decision-approval-gate(같은 Lee 승인 판정)를 이미 통과시켰다.
#   그런데도 approval-gate가 action_required면 approval-checks(5분마다)가 아직 승인을 반영하지 못한 옛 값이다(#920·#925 증상, #926 검토관 지적).
#   단 S6 운영 배포 잠금(approval-checks.mjs: 요약에 '운영 배포 검증 실패')은 몇 시간 갈 수 있어 blocked — 타이머로 계속 부르지 않고 예약 실행에 맡긴다.
# 최신 1개(started_at) 규칙은 collapse-check-runs.jq와 같다. 다른 앱(PR 브랜치 워크플로)이 만든 같은 이름 검사는 세지 않는다.
(if type == "array" then . else [.] end) as $pages
| ($pages | map(.check_runs // []) | add // []) as $runs
| ($pages | map(.total_count // 0) | max // 0) as $total
| ($runs | map(select(.app.slug == "viecganban-checks" and .name == "approval-gate")) | sort_by(.started_at) | last) as $g
| if ($runs | length) < $total then "pending"
  elif $g == null then "pending"
  elif $g.status == "completed" and $g.conclusion == "success" then "ok"
  elif $g.conclusion == "action_required" and (($g.output.summary // "") | test("운영 배포 검증 실패")) then "blocked"
  elif $g.status != "completed" or $g.conclusion == "action_required" then "pending"
  else "blocked" end

# 봇 자동병합이 보는 check-run 목록(#728 S1). 입력 = `gh api --paginate --slurp commits/<sha>/check-runs?per_page=100` 응답(페이지 배열)
# 또는 한 페이지짜리 응답 객체. 페이지가 여러 개여도 전부 합친다.
# ① 같은 이름의 검사는 이름당 시작이 가장 늦은 1개(최신)만 본다 — GitHub 자체의 필수 검사 판정과 같은 방식.
#    Ready 전환·본문 수정·새 커밋마다 같은 검사가 새 실행 묶음(check_suite)으로 다시 돌므로, 같은 커밋의 옛 실패 실행이 새 성공을 영원히 막으면 안 된다
#    (#744가 묶음별로 나눠 PR #732처럼 한 번 실패했다 고친 PR을 봇이 영원히 못 병합하던 결함 — 이 파일에서 바로잡음).
#    이름이 같은 서로 다른 워크플로 잡이 최신 1개 규칙에 빨간 검사를 가리는 문제는 판정이 아니라 **이름을 겹치지 않게** 하는
#    scripts/ci/required-check-names.test.mjs(PR마다 실행)가 막는다.
# ② GitHub가 알려 준 전체 개수(total_count)보다 실제로 받은 개수가 적으면(조회가 잘렸으면) 가짜 실패 항목 `__incomplete__`를 더해
#    required-checks-pass.jq가 병합을 막게 한다(뒤 페이지의 실패가 안 보이는 채로 통과하지 않게).
(if type == "array" then . else [.] end) as $pages
| ($pages | map(.check_runs // []) | add // []) as $runs
| ($pages | map(.total_count // 0) | max // 0) as $total
| ($runs
   | sort_by(.started_at)
   | group_by(.name)
   | map(last)
   | map({name, conclusion, status})) as $collapsed
| $collapsed + (if ($runs | length) < $total then [{name: "__incomplete__", conclusion: "failure", status: "completed"}] else [] end)

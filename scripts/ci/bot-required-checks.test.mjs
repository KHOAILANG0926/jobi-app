// 봇 자동병합 필수 검사 판정 시험(#728 S1) — 이름이 같은 검사가 둘일 때 빨간 것이 가려지지 않는지.
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const jq = (args, input) => execFileSync('jq', args, { input, encoding: 'utf8' })
const run = (id, name, conclusion, started, suite, status = 'completed') => ({ id, name, conclusion, status, started_at: started, check_suite: { id: suite } })
const base = (extra) => ({ check_runs: [run(1, 'app-screen', 'success', '2026-11-12T10:00:00Z', 10), run(2, 'guard', 'success', '2026-11-12T10:00:00Z', 11),
  run(3, 'publication-gate', 'success', '2026-11-12T10:00:00Z', 12), ...extra] })
const gate = (resp) => {  // resp = 한 페이지 객체 또는 페이지 배열(gh --paginate --slurp)
  const collapsed = jq(['-c', '-f', 'scripts/ci/collapse-check-runs.jq'], JSON.stringify(resp))
  try { jq(['-e', '-f', 'scripts/ci/required-checks-pass.jq'], collapsed); return true } catch { return false }
}
// 수정 전 방식(이름당 마지막 1개)으로 같은 입력을 판정 — 빨간 검사가 가려지는 것을 재현
const oldGate = (resp) => {
  const collapsed = jq(['-c', '.check_runs | sort_by(.started_at) | group_by(.name) | map(last) | map({name,conclusion,status})'], JSON.stringify(resp))
  try { jq(['-e', '-f', 'scripts/ci/required-checks-pass.jq'], collapsed); return true } catch { return false }
}
const realFail = run(4, 'checks', 'failure', '2026-11-12T10:01:00Z', 20)          // pr-checks의 진짜 checks (실패)
const fakeGreenLater = run(5, 'checks', 'success', '2026-11-12T10:01:05Z', 21)    // approved-layout-guard의 항상 초록 checks (나중에 시작)
const fakeGreenEarlier = run(6, 'checks', 'success', '2026-11-12T10:00:55Z', 21)  // (먼저 시작)

assert.equal(oldGate(base([realFail, fakeGreenLater])), true, '수정 전 방식: 초록이 늦게 시작하면 실패가 가려져 통과(결함 재현)')
assert.equal(gate(base([realFail, fakeGreenLater])), false, '초록 checks가 나중에 시작해도 빨간 checks가 보여 병합 보류')
assert.equal(gate(base([realFail, fakeGreenEarlier])), false, '초록 checks가 먼저 시작해도 병합 보류')
// 같은 실행 묶음에서 다시 돌려 성공하면 최신 결과만 본다
assert.equal(gate(base([run(4, 'checks', 'failure', '2026-11-12T10:01:00Z', 20), run(7, 'checks', 'success', '2026-11-12T10:05:00Z', 20), fakeGreenLater])), true, '같은 묶음 재실행 성공은 통과')
assert.equal(gate(base([run(4, 'checks', 'success', '2026-11-12T10:01:00Z', 20), fakeGreenLater])), true, '둘 다 성공하면 통과')
assert.equal(gate({ check_runs: [run(1, 'app-screen', 'success', 'a', 10), run(2, 'guard', 'success', 'a', 11), run(4, 'checks', 'success', 'a', 20)] }), false, 'publication-gate 없으면 보류')
assert.equal(gate(base([run(4, 'checks', 'success', 'a', 20, 'in_progress')])), false, '실행 중이면 보류')
// 100개 초과(여러 페이지): 실패가 뒤 페이지에 있어도 보여야 한다
{
  const filler = (from, n) => Array.from({ length: n }, (_, i) => run(1000 + from + i, `other-${from + i}`, 'success', '2026-11-12T10:00:00Z', 100 + from + i))
  const page1 = { total_count: 105, check_runs: [run(1, 'app-screen', 'success', 'a', 10), run(2, 'guard', 'success', 'a', 11), run(3, 'publication-gate', 'success', 'a', 12), run(4, 'checks', 'success', 'a', 20), ...filler(0, 96)] }
  const page2failing = { total_count: 105, check_runs: [run(9001, 'checks', 'failure', '2026-11-12T10:02:00Z', 21), ...filler(200, 4)] }
  const page2green = { total_count: 105, check_runs: [run(9001, 'checks', 'success', '2026-11-12T10:02:00Z', 21), ...filler(200, 4)] }
  // 수정 전 방식은 첫 페이지(100개)만 봐서 뒤 페이지의 빨간 검사를 못 본다 — 재현
  assert.equal(oldGate(page1), true, '수정 전: 첫 100개만 보면 뒤 페이지 실패를 못 보고 통과(결함 재현)')
  assert.equal(gate([page1, page2failing]), false, '2페이지의 실패한 checks도 병합 보류')
  assert.equal(gate([page1, page2green]), true, '2페이지까지 전부 성공이면 통과')
  assert.equal(gate(page1), false, '조회가 잘렸으면(받은 개수 < total_count) 안전하게 병합 보류')
}
console.log('bot-required-checks.test.mjs: 이름 충돌·100개 초과 가림 재현(수정 전) + 수정 후 통과')

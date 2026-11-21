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

// 같은 커밋의 이벤트마다(Ready 전환·본문 수정) 같은 검사가 새 실행 묶음으로 다시 돈다 — 옛 실패 위에 새 성공이 있으면 통과해야 한다(PR #732에서 #744가 이걸 막았던 결함의 재현·수정 시험)
const SUITE_STRICT = (resp) => {  // #744 방식(이름+묶음으로 나눔) 재현
  const c = jq(['-c', '.check_runs | sort_by(.started_at) | group_by(.name + "|" + ((.check_suite.id // 0) | tostring)) | map(last) | map({name,conclusion,status})'], JSON.stringify(resp))
  try { jq(['-e', '-f', 'scripts/ci/required-checks-pass.jq'], c); return true } catch { return false }
}
const failedEarlier = run(4, 'checks', 'failure', '2026-11-12T10:01:00Z', 20)
const greenLater = run(7, 'checks', 'success', '2026-11-12T10:05:00Z', 22)
assert.equal(SUITE_STRICT(base([failedEarlier, greenLater])), false, '#744 방식: 같은 커밋의 옛 실패 실행이 새 성공을 영원히 막음(결함 재현)')
assert.equal(gate(base([failedEarlier, greenLater])), true, '이름당 최신 1개: 옛 실패 뒤 새 성공이면 통과')
assert.equal(gate(base([run(4, 'checks', 'success', '2026-11-12T10:01:00Z', 20), run(8, 'checks', 'failure', '2026-11-12T10:06:00Z', 23)])), false, '최신이 실패면 보류')
assert.equal(gate(base([run(4, 'checks', 'failure', '2026-11-12T10:01:00Z', 20), run(9, 'checks', 'success', '2026-11-12T10:07:00Z', 24, 'in_progress')])), false, '최신이 실행 중이면 보류')
assert.equal(gate(base([realFail])), false, '실패한 checks 하나뿐이면 보류')
assert.equal(gate(base([run(4, 'checks', 'success', '2026-11-12T10:01:00Z', 20)])), true, 'checks 성공이면 통과')
// 이름이 같은 서로 다른 워크플로 잡의 충돌은 판정이 아니라 scripts/ci/required-check-names.test.mjs(정적, PR마다)가 막는다.
assert.equal(gate({ check_runs: [run(1, 'app-screen', 'success', '2026-11-12T09:00:00Z', 10), run(2, 'guard', 'success', '2026-11-12T09:00:00Z', 11), run(4, 'checks', 'success', '2026-11-12T09:00:00Z', 20)] }), false, 'publication-gate 없으면 보류')
assert.equal(gate(base([run(4, 'checks', 'success', '2026-11-12T09:00:00Z', 20, 'in_progress')])), false, '실행 중이면 보류')
// 100개 초과(여러 페이지): 실패가 뒤 페이지에 있어도 보여야 한다
{
  const filler = (from, n) => Array.from({ length: n }, (_, i) => run(1000 + from + i, `other-${from + i}`, 'success', '2026-11-12T10:00:00Z', 100 + from + i))
  const page1 = { total_count: 105, check_runs: [run(1, 'app-screen', 'success', '2026-11-12T09:00:00Z', 10), run(2, 'guard', 'success', '2026-11-12T09:00:00Z', 11), run(3, 'publication-gate', 'success', '2026-11-12T09:00:00Z', 12), run(4, 'checks', 'success', '2026-11-12T09:00:00Z', 20), ...filler(0, 96)] }
  const page2failing = { total_count: 105, check_runs: [run(9001, 'checks', 'failure', '2026-11-12T10:02:00Z', 21), ...filler(200, 4)] }
  const page2green = { total_count: 105, check_runs: [run(9001, 'checks', 'success', '2026-11-12T10:02:00Z', 21), ...filler(200, 4)] }
  // 수정 전 방식은 첫 페이지(100개)만 봐서 뒤 페이지의 빨간 검사를 못 본다 — 재현
  assert.equal(oldGate(page1), true, '수정 전: 첫 100개만 보면 뒤 페이지 실패를 못 보고 통과(결함 재현)')
  assert.equal(gate([page1, page2failing]), false, '2페이지의 실패한 checks도 병합 보류')
  assert.equal(gate([page1, page2green]), true, '2페이지까지 전부 성공이면 통과')
  assert.equal(gate(page1), false, '조회가 잘렸으면(받은 개수 < total_count) 안전하게 병합 보류')
}
console.log('bot-required-checks.test.mjs: 이름 충돌·100개 초과 가림 재현(수정 전) + 수정 후 통과')

// 조회 스크립트(fetch-check-runs.sh) 시험: 가짜 gh로 정상·다중 페이지·실패·잘림을 흉내낸다. 실패하면 비정상 종료해야 봇이 병합을 건너뛴다.
{
  const { mkdtempSync, writeFileSync, chmodSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const dir = mkdtempSync(join(tmpdir(), 'fakegh-'))
  const fake = (body) => { writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash\n${body}\n`); chmodSync(join(dir, 'gh'), 0o755) }
  const exec = () => spawnSync('bash', ['scripts/ci/fetch-check-runs.sh', 'o/r', 'abc'], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, encoding: 'utf8' })
  const pages = (arr) => JSON.stringify(arr).replace(/'/g, "'\\''")
  const ok = (id, name, c = 'success') => ({ id, name, conclusion: c, status: 'completed', started_at: 't', check_suite: { id } })
  fake(`echo '${pages([{ total_count: 2, check_runs: [ok(1, 'checks')] }, { total_count: 2, check_runs: [ok(2, 'guard')] }])}'`)
  let r = exec()
  assert.equal(r.status, 0, '정상 다중 페이지는 종료 코드 0')
  assert.equal(JSON.parse(r.stdout).length, 2, '두 페이지를 합쳐 2개')
  fake(`echo '{"message":"Bad credentials"}' >&2; exit 1`)
  r = exec(); assert.notEqual(r.status, 0, 'gh 인증/호출 실패는 비정상 종료(봇은 병합 건너뜀)')
  fake(`echo '${pages([{ total_count: 5, check_runs: [ok(1, 'checks')] }])}'; exit 1`)
  r = exec(); assert.notEqual(r.status, 0, '일부 출력 뒤 gh 실패도 비정상 종료(pipefail)')
  fake(`echo '${pages([{ total_count: 5, check_runs: [ok(1, 'checks')] }])}'`)
  r = exec(); assert.equal(r.status, 0, '잘렸어도 스크립트는 출력을 주지만')
  assert.ok(JSON.parse(r.stdout).some((x) => x.name === '__incomplete__'), '__incomplete__ 실패 항목이 들어가 판정이 병합을 막음')
  fake('exit 0')
  r = exec()
  let passed = false
  try { jq(['-e', '-f', 'scripts/ci/required-checks-pass.jq'], r.stdout); passed = true } catch { passed = false }
  assert.equal(passed, false, 'gh가 빈 출력으로 성공해도(필수 검사가 하나도 없음) 판정은 병합 보류')
  console.log('bot-required-checks.test.mjs: 조회 스크립트 실패·잘림·다중 페이지 시험 통과')
}

// S8 봇 병합 직전 판정(merge-gate-ready.jq): 병합 조건 검사(검사 전용 앱 approval-gate). ai-review(독립 검토)는 병합 조건이 아니다(Lee 2026-11-21).
{
  const g = (resp) => jq(['-r', '-f', 'scripts/ci/merge-gate-ready.jq'], JSON.stringify(resp)).trim()
  const cr = (id, name, status, conclusion, started, slug = 'viecganban-checks') => ({ id, name, status, conclusion, started_at: started, app: { slug } })
  const okBoth = [cr(1, 'ai-review', 'completed', 'neutral', 't1'), cr(2, 'approval-gate', 'completed', 'success', 't1')]
  assert.equal(g({ check_runs: okBoth }), 'ok', 'approval-gate 성공 → ok')
  assert.equal(g({ check_runs: [okBoth[1]] }), 'ok', 'ai-review가 없어도 approval-gate 성공이면 ok(11-21)')
  for (const rv of [cr(1, 'ai-review', 'in_progress', null, 't1'), cr(1, 'ai-review', 'completed', 'failure', 't1')])
    assert.equal(g({ check_runs: [rv, okBoth[1]] }), 'ok', `ai-review ${rv.status}/${rv.conclusion}이어도 병합을 막지 않음(11-21)`)
  // 봇은 이 판정 앞에서 decision-approval-gate(Lee 승인)를 이미 통과시켰다 → action_required는 아직 반영 안 된 옛 값(#920·#925)
  assert.equal(g({ check_runs: [okBoth[0], cr(2, 'approval-gate', 'completed', 'action_required', 't1')] }), 'pending', '승인 통과 뒤 옛 action_required → pending(6분 뒤 다시)')
  assert.equal(g({ check_runs: [okBoth[0], cr(2, 'approval-gate', 'in_progress', null, 't1')] }), 'pending', 'approval-gate 진행 중 → pending')
  assert.equal(g({ check_runs: [okBoth[0], cr(2, 'approval-gate', 'completed', 'failure', 't1')] }), 'blocked', '실패 → blocked(다시 안 부름)')
  assert.equal(g({ check_runs: [okBoth[0], { ...cr(2, 'approval-gate', 'completed', 'action_required', 't1'), output: { summary: '운영 배포 검증 실패 이슈 #918(47fc051) 열림 — 일반 PR 자동 병합 잠금(S6)' } }] }), 'blocked', 'S6 배포 잠금 → blocked(몇 시간 갈 수 있어 예약 실행에 맡김)')
  assert.equal(g({ check_runs: [] }), 'pending', '아직 없음 → pending')
  assert.equal(g({ check_runs: [okBoth[0]] }), 'pending', 'approval-gate 없음 → pending')
  assert.equal(g({ check_runs: [cr(2, 'approval-gate', 'completed', 'success', 't1', 'github-actions')] }), 'pending', '다른 앱이 만든 같은 이름은 세지 않음')
  assert.equal(g({ check_runs: [cr(2, 'approval-gate', 'completed', 'failure', 't1'), cr(3, 'approval-gate', 'completed', 'success', 't2')] }), 'ok', '최신 1개')
  assert.equal(g({ check_runs: [cr(2, 'approval-gate', 'completed', 'success', 't1'), cr(3, 'approval-gate', 'completed', 'failure', 't2')] }), 'blocked', '최신 1개(뒤가 실패면 실패)')
  const filler = Array.from({ length: 99 }, (_, i) => cr(100 + i, `other-${i}`, 'completed', 'success', 't0', 'github-actions'))
  assert.equal(g([{ total_count: 101, check_runs: [...filler, okBoth[0]] }, { total_count: 101, check_runs: [okBoth[1]] }]), 'ok', '여러 쪽: 뒤 쪽의 판정도 읽음')
  assert.equal(g([{ total_count: 101, check_runs: [...filler, okBoth[0]] }]), 'pending', '조회 잘림 → pending')
}
console.log('merge-gate-ready.jq: ok·pending·blocked·다른 앱·최신 1개·여러 쪽 시험 통과')

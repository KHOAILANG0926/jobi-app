// S4 8단계 재현 시험(Codex P1 2건): GitHub API를 흉내 내어 main()을 실제로 돌린다.
//  ① 같은 head SHA를 쓰는 PR 둘 — 한 PR의 승인이 다른 PR의 미승인 판정을 success로 덮어쓰지 않는다
//  ② 재판정 중 API 조회가 실패하면 이미 있던 success가 남지 않는다(pending → failure)
import assert from 'node:assert/strict'
import { main } from './approval-checks.mjs'
process.env.CHECKS_APP_SLUG = 'claude'  // 흉내 낸 GitHub가 돌려주는 기존 검사의 앱 이름과 맞춤
const repo = 'KHOAILANG0926/jobi-app', sha = 'a'.repeat(40), later = '2026-11-15T10:20:00Z'
const body = ['## 고위험 4대 보고', '- 무엇을 바꾸나: 검사 설정 변경', '- 왜 필요한가: 병합 보호 강화', '- 승인 시 남는 위험: 설정 오류 가능', '- 미승인 시 영향: 보호 지연', `- 검증: https://github.com/${repo}/actions/runs/1`].join('\n')
const claudeOk = { user: { login: 'claude[bot]' }, body: `<!-- claude-fallback-review -->\nsha: ${sha}\nfindings: 0\n\nok`, created_at: '2026-11-15T10:05:00Z' }
const leeOk = { user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: sha, submitted_at: later }
const pr = (number, extra = {}) => ({ number, draft: false, state: 'open', base: { ref: 'master', sha: 'b'.repeat(40) }, head: { sha, repo: { full_name: repo } }, user: { login: 'viecganban-bot' }, labels: [], body, ...extra })

function world({ prs, reviews, comments, existing = {}, failFiles = false, gate = null, issues = [], files = null, deployOk = null, compare = {} }) {
  const writes = [], runs = { ...existing }, compareCalls = []
  const res = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => (typeof data === 'string' ? data : JSON.stringify(data)) })
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('https://api.github.com/', ''), method = init.method ?? 'GET'
    if (method === 'GET') {
      let m
      if (/^repos\/[^/]+\/[^/]+\/pulls\?/.test(path)) return res(path.includes('page=1') ? prs : [])
      if (/^repos\/[^/]+\/[^/]+\/issues\?state=open/.test(path)) return res(path.includes('page=1') ? issues : [])
      if (/actions\/workflows\/deploy-verify\.yml\/runs\?branch=master&status=success/.test(path)) return res({ workflow_runs: deployOk ? [{ head_sha: deployOk }] : [] })
      if ((m = path.match(/compare\/([0-9a-f]+)\.\.\.([0-9a-f]+)/))) { compareCalls.push(path); return res({ status: compare[m[1]] ?? 'diverged' }) }
      if ((m = path.match(/pulls\/(\d+)\/files/))) return failFiles ? res({ message: 'unavailable' }, 503) : res(path.includes('page=1') ? (files ?? [{ filename: '.github/workflows/x.yml', status: 'modified', patch: '@@\n+x' }]) : [])
      if ((m = path.match(/pulls\/(\d+)\/reviews/))) return res(path.includes('page=1') ? (reviews[m[1]] ?? []) : [])
      if (/pulls\/\d+\/comments/.test(path)) return res([])
      if ((m = path.match(/issues\/(\d+)\/comments/))) {
        const snap = path.includes('page=1') ? JSON.parse(JSON.stringify(comments[m[1]] ?? [])) : []
        // 시험용 지연: 첫 조회는 '그 시점 자료'를 쥔 채 풀어 줄 때까지 응답을 늦춘다(오래된 실행 흉내)
        if (gate && !gate.used && path.includes('page=1')) { gate.used = true; gate.started(); await gate.release }
        return res(snap)
      }
      if ((m = path.match(/pulls\/(\d+)(\?|$)/))) return res(prs.find((p) => p.number === Number(m[1])))
      if (/\/commits\/[0-9a-f]+\/check-runs/.test(path)) { const n = path.match(/check_name=([\w-]+)/)[1]; return res({ check_runs: runs[n] ? [{ id: runs[n].id, app: { slug: 'claude' } }] : [] }) }
      if (/\/commits\/[0-9a-f]+$/.test(path)) return res({ commit: { committer: { date: '2026-11-15T10:00:00Z' } } })
      return res({ message: `unmocked ${path}` }, 404)
    }
    const body = JSON.parse(init.body), name = body.name ?? Object.keys(runs).find((k) => String(path).endsWith(`/${runs[k].id}`))
    const rec = { name, state: body.status === 'completed' ? body.conclusion : body.status, summary: body.output?.summary }
    writes.push(rec); runs[name] = { id: runs[name]?.id ?? Object.keys(runs).length + 1, ...rec }
    return res({ id: runs[name].id })
  }
  return { writes, runs, compareCalls }
}
process.env.GITHUB_TOKEN = 'x'
const opts = { getAppToken: async () => 'app', framePaths: [] }
const last = (writes, name) => writes.filter((w) => w.name === name).at(-1)

// ① 같은 SHA 두 PR: A는 Lee 승인·검토 통과, B는 승인 없음 → 공유된 approval-gate는 success가 아니어야 한다
{
  const w = world({ prs: [pr(1), pr(2)], reviews: { 1: [leeOk], 2: [] }, comments: { 1: [claudeOk], 2: [claudeOk] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.equal(last(w.writes, 'approval-gate').state, 'action_required', '같은 SHA의 미승인 PR(#2)이 있으면 승인 대기')
  assert.match(last(w.writes, 'approval-gate').summary, /#1·#2.*#2/, '어느 PR 때문인지 적음')
  assert.ok(!w.writes.some((x) => x.name === 'approval-gate' && x.state === 'success'), 'success를 한 번도 올리지 않음')
  // 두 PR 모두 Lee 승인이 있으면 통과
  const w2 = world({ prs: [pr(1), pr(2)], reviews: { 1: [leeOk], 2: [leeOk] }, comments: { 1: [claudeOk], 2: [claudeOk] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.equal(last(w2.writes, 'approval-gate').state, 'success')
  // 4대 보고 강제 폐지(Lee 2026-11-21): 한쪽 본문이 비어도 둘 다 Lee 승인이면 통과
  const w3 = world({ prs: [pr(1), pr(2, { body: '' })], reviews: { 1: [leeOk], 2: [leeOk] }, comments: { 1: [claudeOk], 2: [claudeOk] } })
  await main(['--repo', repo, '--pr', '2'], opts)
  assert.equal(last(w3.writes, 'approval-gate').state, 'success', '본문 보고 없어도 Lee 승인이면 통과(11-21)')
  // ai-review 검사는 11-21 Ruleset에서 빠진 뒤 지움 — 더 올리지 않는다
  const w4 = world({ prs: [pr(1), pr(2)], reviews: { 1: [leeOk], 2: [leeOk] }, comments: { 1: [claudeOk], 2: [] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.ok(!w4.writes.some((x) => x.name === 'ai-review'), 'ai-review 검사를 올리지 않음')
  assert.equal(last(w4.writes, 'approval-gate').state, 'success')
}

// ② 수집 실패: 이미 success였던 두 검사가 pending으로 내려가고 마지막은 failure — success로 남지 않는다
{
  const w = world({ prs: [pr(1)], reviews: { 1: [leeOk] }, comments: { 1: [claudeOk] }, existing: { 'approval-gate': { id: 102, state: 'success' } }, failFiles: true })
  await assert.rejects(() => main(['--repo', repo, '--pr', '1'], opts), /재판정 실패/, '실행은 실패로 끝남')
  for (const n of ['approval-gate']) {
    const mine = w.writes.filter((x) => x.name === n)
    assert.equal(mine[0].state, 'in_progress', `${n}: 수집 전에 대기로 내림`)
    assert.equal(mine.at(-1).state, 'failure', `${n}: 마지막은 실패`)
    assert.equal(w.runs[n].state, 'failure', `${n}: 남은 결과가 success가 아님`)
    assert.ok(!mine.some((x) => x.state === 'success'))
  }
  // 정상이면 pending → success 로 돌아온다
  const ok = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments: { 1: [claudeOk] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.equal(ok.writes.filter((x) => x.name === 'approval-gate')[0].state, 'in_progress'); assert.equal(last(ok.writes, 'approval-gate').state, 'action_required')
  assert.ok(!ok.writes.some((x) => x.name === 'ai-review'), 'ai-review 없음')
}
// ③ 동시 실행 순서 뒤바뀜(Codex P1): 오래된 실행 A가 자료를 모은 뒤 멈춰 있는 동안, 새 상태를 본 실행 B가 먼저 끝난다. A가 나중에 끝나도 최신 판정(대기)을 success로 덮으면 안 된다.
//    (approval-gate로 본다 — A는 Lee 승인이 있던 옛 자료, B는 승인 뒤 변경 요청을 본다)
{
  let startedA, releaseA; const started = new Promise((r) => (startedA = r)), release = new Promise((r) => (releaseA = r))
  const reviews = { 1: [leeOk] }
  const w = world({ prs: [pr(1, { body: 'x' })], reviews, comments: { 1: [] }, gate: { used: false, started: startedA, release } })
  const runA = main(['--repo', repo, '--pr', '1'], opts)          // A: 승인이 있던 옛 자료를 쥐고 멈춤
  await started
  reviews[1] = [leeOk, { ...leeOk, state: 'CHANGES_REQUESTED', submitted_at: '2026-11-15T10:40:00Z' }]
  await main(['--repo', repo, '--pr', '1'], opts)                 // B: 변경 요청을 보고 끝까지 실행
  assert.equal(last(w.writes, 'approval-gate').state, 'action_required', 'B 뒤: 승인 뒤 변경 요청 → 대기')
  releaseA(); await runA                                          // A가 뒤늦게 끝남
  assert.notEqual(last(w.writes, 'approval-gate').state, 'success', '오래된 실행이 늦게 끝나도 최신 판정을 success로 덮지 못함')
  assert.equal(last(w.writes, 'approval-gate').state, 'action_required', '마지막 판정은 대기 유지')
}
// 워크플로: 모든 실행이 한 동시성 그룹에서 직렬로 돌고 매 실행이 열린 PR 전체를 다시 판정
{ const { readFileSync } = await import('node:fs'); const yml = readFileSync(new URL('../../.github/workflows/approval-checks.yml', import.meta.url), 'utf8').replace(/^\s*#.*$/gm, '')
  assert.match(yml, /concurrency:\s*\n\s*group: approval-checks\s*\n/, '동시성 그룹이 PR 번호와 무관한 하나'); assert.ok(!/group:.*\$\{\{/.test(yml), '그룹 이름에 PR 번호를 넣지 않음')
  assert.match(yml, /--all \$\{PR:\+--pr "\$PR"\}/, '매 실행이 전체(--all)를 다시 판정') }
// 열린 PR이 아니면 아무것도 올리지 않음
{ const w = world({ prs: [], reviews: {}, comments: {} }); await main(['--repo', repo, '--pr', '9'], opts); assert.equal(w.writes.length, 0) }
// S4 B단계(Lee 2026-11-16): 검사 전용 앱 — 토큰·앱 이름이 없으면 실행 실패(닫힌 실패), 고칠 대상은 이 앱이 만든 검사만
{
  const { checksAppToken } = await import('./approval-checks.mjs')
  const saved = { t: process.env.CHECKS_APP_TOKEN, s: process.env.CHECKS_APP_SLUG }
  try {
    delete process.env.CHECKS_APP_TOKEN; assert.throws(() => checksAppToken(), /검사 전용 앱 토큰 없음/, '토큰 없으면 멈춤')
    process.env.CHECKS_APP_TOKEN = 'app'; delete process.env.CHECKS_APP_SLUG; assert.throws(() => checksAppToken(), /검사 전용 앱 이름 없음/, '앱 이름 없으면 멈춤')
    process.env.CHECKS_APP_SLUG = 'viecganban-checks'; assert.equal(checksAppToken(), 'app')
  } finally { process.env.CHECKS_APP_TOKEN = saved.t; process.env.CHECKS_APP_SLUG = saved.s }
  // 다른 앱(예: 예전 Claude 앱)이 만든 같은 이름 검사는 고치지 않고 이 앱 이름으로 새로 만든다
  const w = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments: { 1: [claudeOk] }, existing: { 'approval-gate': { id: 7 } } })
  const inner = globalThis.fetch, patched = []
  globalThis.fetch = async (url, init = {}) => { if (init.method === 'PATCH') patched.push(String(url)); return inner(url, init) }
  process.env.CHECKS_APP_SLUG = 'other-app'
  try { await main(['--repo', repo, '--pr', '1'], opts) } finally { process.env.CHECKS_APP_SLUG = saved.s }
  assert.ok(!patched.some((u) => u.endsWith('/check-runs/7')), '다른 앱 검사(id 7)는 고치지 않음')
}
// 앱 토큰(checks 권한만)은 check-runs 말고 다른 API를 부르지 않는다 — 권한 밖 호출은 403을 돌려주는 가짜로 확인(검토관 지적 1854918)
{
  const w = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments: { 1: [claudeOk] } })
  const inner = globalThis.fetch, outside = []
  globalThis.fetch = async (url, init = {}) => {
    const auth = init.headers?.Authorization ?? ''
    if (auth === 'Bearer app' && !/\/check-runs/.test(String(url))) { outside.push(String(url)); return { ok: false, status: 403, json: async () => ({}), text: async () => '{"message":"Resource not accessible by integration"}' } }
    return inner(url, init)
  }
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.deepEqual(outside, [], '앱 토큰으로 check-runs 밖 API 호출 없음')
  assert.ok(last(w.writes, 'approval-gate'), '권한 밖 403 가짜에서도 검사 게시 완료')
}
// 검사 생성이 거절되면(403) 실행이 실패로 끝난다(닫힌 실패, 성공 표시 없음)
{
  const w = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments: { 1: [claudeOk] } })
  const inner = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => ((init.method ?? 'GET') !== 'GET' && /check-runs/.test(String(url)) ? { ok: false, status: 403, json: async () => ({}), text: async () => '{"message":"Resource not accessible by integration"}' } : inner(url, init))
  const err = console.error; console.error = () => {}
  try { await assert.rejects(main(['--repo', repo, '--pr', '1'], opts), /재판정 실패/, '검사 생성 403이면 실행 실패') } finally { console.error = err }
  assert.ok(!w.writes.some((x) => x.state === 'success'), '성공 표시가 하나도 올라가지 않음')
}
console.log('approval-checks main 재현 시험 통과(같은 SHA PR 오염 차단·수집 실패 시 옛 성공 무효)')

// S6 운영 배포 잠금: deploy-verify가 연 '운영 배포 검증 실패' 이슈가 있으면 일반 PR도 Lee 승인 필요(자동 병합 잠금)
{
  const normal = [{ filename: 'src/a.ts', status: 'modified', patch: '@@\n+x' }]
  const lockIssue = { number: 77, state: 'open', title: '운영 배포 검증 실패: abc1234', user: { login: 'github-actions[bot]' } }
  const w0 = world({ prs: [pr(5, { body: '' })], reviews: { 5: [] }, comments: { 5: [claudeOk] }, files: normal })
  await main(['--repo', repo, '--pr', '5'], opts)
  assert.equal(last(w0.writes, 'approval-gate').state, 'success', '잠금 이슈 없으면 일반 PR 통과(기존 그대로)')
  const w1 = world({ prs: [pr(5, { body: '' })], reviews: { 5: [] }, comments: { 5: [claudeOk] }, files: normal, issues: [lockIssue] })
  await main(['--repo', repo, '--pr', '5'], opts)
  assert.equal(last(w1.writes, 'approval-gate').state, 'action_required', '잠금 중 일반 PR은 자동 병합 안 됨')
  assert.match(last(w1.writes, 'approval-gate').summary, /#77\(abc1234\).*잠금/)
  const w2 = world({ prs: [pr(5, { body: '' })], reviews: { 5: [leeOk] }, comments: { 5: [claudeOk] }, files: normal, issues: [lockIssue] })
  await main(['--repo', repo, '--pr', '5'], opts)
  assert.equal(last(w2.writes, 'approval-gate').state, 'success', '잠금 중이어도 Lee 승인(최신 커밋)한 복구 PR은 통과')
  const fakes = [{ ...lockIssue, user: { login: 'someone' } }, { ...lockIssue, state: 'closed' }, { ...lockIssue, pull_request: {} }, { ...lockIssue, title: '운영 배포 검증 실패 아님' }]
  const w3 = world({ prs: [pr(5, { body: '' })], reviews: { 5: [] }, comments: { 5: [claudeOk] }, files: normal, issues: fakes })
  await main(['--repo', repo, '--pr', '5'], opts)
  assert.equal(last(w3.writes, 'approval-gate').state, 'success', '다른 사람이 연 같은 제목·닫힌 이슈·PR·다른 제목은 잠금 아님')
  // 풀림: master에서 가장 최근 성공한 deploy-verify 커밋이 실패 커밋을 포함하면 잠금 아님(이슈가 열려 있어도), 포함 안 하면(갈라짐) 잠금 유지
  const w4 = world({ prs: [pr(5, { body: '' })], reviews: { 5: [] }, comments: { 5: [claudeOk] }, files: normal, issues: [lockIssue], deployOk: 'd'.repeat(40), compare: { abc1234: 'ahead' } })
  await main(['--repo', repo, '--pr', '5'], opts)
  assert.equal(last(w4.writes, 'approval-gate').state, 'success', '실패 커밋을 포함한 master가 배포 확인 통과 → 잠금 풀림')
  const w5 = world({ prs: [pr(5, { body: '' })], reviews: { 5: [] }, comments: { 5: [claudeOk] }, files: normal, issues: [lockIssue], deployOk: 'd'.repeat(40), compare: { abc1234: 'diverged' } })
  await main(['--repo', repo, '--pr', '5'], opts)
  assert.equal(last(w5.writes, 'approval-gate').state, 'action_required', '성공한 커밋이 실패 커밋을 포함하지 않으면 잠금 유지')
  // 한 실행에서 같은 비교는 한 번만(PR 2건 × 판정 2번이어도) — 403(시간당 한도) 재발 방지(2026-11-19)
  const other = { sha: 'f'.repeat(40), repo: { full_name: repo } }
  const w6 = world({ prs: [pr(301, { body: '' }), pr(302, { body: '', head: other })], reviews: { 301: [], 302: [] }, comments: { 301: [claudeOk], 302: [{ ...claudeOk, body: claudeOk.body.replace(sha, other.sha) }] }, files: normal, issues: [lockIssue, { ...lockIssue, number: 78, title: '운영 배포 검증 실패: def5678' }], deployOk: 'd'.repeat(40), compare: { abc1234: 'ahead', def5678: 'ahead' } })
  await main(['--repo', repo, '--all'], opts)
  assert.equal(w6.compareCalls.length, 2, `잠금 이슈 2건 → 비교 2번(PR·판정 수와 무관), 실제 ${w6.compareCalls.length}`)
}
console.log('approval-checks main: 운영 배포 잠금 시험 통과')

// S1 B3(#808): 봇 병합 직전 운영 배포 잠금 재확인 — 기존 activeLocks 재사용, 잠금 있음·Lee 승인 예외·조회 실패·잠금 없음·기억 범위
{
  const { mergeLockDecision, mergeLockCli } = await import('./approval-checks.mjs')
  const { mkdtempSync, writeFileSync: wf, readFileSync: rf } = await import('node:fs')
  const { tmpdir } = await import('node:os'), { join } = await import('node:path')
  const lockIssue = { number: 77, state: 'open', title: '운영 배포 검증 실패: abc1234', user: { login: 'github-actions[bot]' } }
  const base = { token: 't', repo, sha, author: 'viecganban-bot', waitMs: 0, sleep: async () => {} }
  // 잠금 없음 → 통과
  world({ prs: [], reviews: {}, comments: {} })
  let d = await mergeLockDecision({ ...base, reviews: [] })
  assert.deepEqual([d.ok, d.state], [true, 'none'], 'B3: 잠금 이슈 없으면 병합 진행')
  // 잠금 있음 → 병합 생략
  world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue] })
  d = await mergeLockDecision({ ...base, reviews: [] })
  assert.deepEqual([d.ok, d.state], [false, 'locked'], 'B3: 잠금 중 Lee 승인 없는 PR은 병합 생략'); assert.match(d.summary, /#77\(abc1234\)/)
  // 잠금 있음 + 이 커밋 Lee 승인 → 통과(복구 PR, approval-gate와 같은 기준)
  d = await mergeLockDecision({ ...base, reviews: [leeOk] })
  assert.deepEqual([d.ok, d.state], [true, 'lee-approved'], 'B3: 잠금 중이어도 최신 커밋 Lee 승인은 통과')
  // 예외는 최신 커밋 승인만: 옛 커밋 승인·작성자가 Lee(자기 승인)·승인 뒤 변경 요청은 무효
  d = await mergeLockDecision({ ...base, reviews: [{ ...leeOk, commit_id: 'c'.repeat(40) }] }); assert.equal(d.state, 'locked', 'B3: 옛 커밋 Lee 승인은 예외 아님')
  d = await mergeLockDecision({ ...base, author: 'KHOAILANG0926', reviews: [leeOk] }); assert.equal(d.state, 'locked', 'B3: Lee 본인 작성 PR 자기 승인은 예외 아님')
  d = await mergeLockDecision({ ...base, reviews: [leeOk, { ...leeOk, state: 'CHANGES_REQUESTED', submitted_at: '2026-11-15T10:30:00Z' }] }); assert.equal(d.state, 'locked', 'B3: 승인 뒤 변경 요청이면 예외 아님')
  // 해제 규칙은 activeLocks 그대로: 실패 커밋을 포함한 master 성공 → 잠금 아님 / 갈라짐 → 잠금 유지
  world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue], deployOk: 'd'.repeat(40), compare: { abc1234: 'ahead' } })
  d = await mergeLockDecision({ ...base, reviews: [] }); assert.equal(d.state, 'none', 'B3: 해제된 잠금 이슈(실패 커밋 포함 성공)는 막지 않음')
  world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue], deployOk: 'd'.repeat(40), compare: { abc1234: 'diverged' } })
  d = await mergeLockDecision({ ...base, reviews: [] }); assert.equal(d.state, 'locked', 'B3: 포함하지 않는 성공은 해제 아님')
  // 조회 실패(403) → 최대 2회 재시도(총 3회) 뒤 병합 보류. 실패를 '잠금 없음'으로 보지 않는다
  let calls = 0, waits = 0
  const inner = globalThis.fetch
  globalThis.fetch = async (url, init) => (/issues\?state=open/.test(String(url)) ? (calls++, { ok: false, status: 403, json: async () => ({}), text: async () => '' }) : inner(url, init))
  d = await mergeLockDecision({ ...base, reviews: [leeOk], sleep: async () => { waits++ } })
  assert.deepEqual([d.ok, d.state, d.attempts, calls, waits], [false, 'error', 3, 3, 2], 'B3: 403이면 2회만 다시 시도하고 병합 보류(Lee 승인이 있어도 조회 실패는 보류)')
  assert.match(d.summary, /403.*병합 보류/)
  // 네트워크 오류 1회 뒤 성공 → 그 결과로 판정(재시도가 실제로 결과를 씀)
  world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue] })
  const inner2 = globalThis.fetch; let first = true
  globalThis.fetch = async (url, init) => { if (first && /issues\?state=open/.test(String(url))) { first = false; throw new Error('network down') } return inner2(url, init) }
  d = await mergeLockDecision({ ...base, reviews: [] })
  assert.deepEqual([d.state, d.attempts], ['locked', 2], 'B3: 네트워크 오류 뒤 재시도 성공이면 실제 잠금 상태로 판정')
  // 기억 범위: compare만 같은 실행 안에서 공유, 잠금 이슈·deploy-verify 성공 기록은 부를 때마다 새로 읽음 → 이슈가 새로 생기면 바로 잠금
  const w = world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue], deployOk: 'd'.repeat(40), compare: { abc1234: 'ahead' } })
  const compares = new Map()
  assert.equal((await mergeLockDecision({ ...base, compares })).state, 'none')
  assert.equal((await mergeLockDecision({ ...base, compares })).state, 'none')
  assert.equal(w.compareCalls.length, 1, 'B3: 같은 실행 안 같은 비교는 한 번만(403 한도 재발 방지)')
  const w2 = world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue, { ...lockIssue, number: 78, title: '운영 배포 검증 실패: def5678' }], deployOk: 'd'.repeat(40), compare: { abc1234: 'ahead' } })
  d = await mergeLockDecision({ ...base, compares })
  assert.deepEqual([d.state, w2.compareCalls.length], ['locked', 1], 'B3: 기억이 있어도 새로 열린 잠금 이슈는 새로 읽어 잠금(오래된 기억으로 잠금 없음 판정 금지)')
  // CLI: 종료 코드 0 통과 · 3 잠금 · 4 조회 실패/인자 없음, 실행 사이 기억 파일 공유
  const dir = mkdtempSync(join(tmpdir(), 'b3-')), rv = join(dir, 'reviews.json'), cache = join(dir, 'lock-cache.json')
  wf(rv, '[]'); process.env.GITHUB_TOKEN = 't'
  const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn() } finally { console.log = log } }
  world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue] })
  assert.equal(await quiet(() => mergeLockCli({ repo, sha, author: 'viecganban-bot', reviews: rv, cache })), 3, 'B3 CLI: 잠금 → 3')
  world({ prs: [], reviews: {}, comments: {} })
  assert.equal(await quiet(() => mergeLockCli({ repo, sha, author: 'viecganban-bot', reviews: rv, cache })), 0, 'B3 CLI: 잠금 없음 → 0')
  assert.equal(await quiet(() => mergeLockCli({ repo, sha, author: 'viecganban-bot', reviews: join(dir, 'none.json'), cache })), 4, 'B3 CLI: 리뷰 파일 못 읽음 → 4(보류)')
  assert.equal(await quiet(() => mergeLockCli({ repo, sha })), 4, 'B3 CLI: 인자 부족 → 4(보류)')
  const wc = world({ prs: [], reviews: {}, comments: {}, issues: [lockIssue], deployOk: 'd'.repeat(40), compare: { abc1234: 'ahead' } })
  wf(cache, '')
  assert.equal(await quiet(() => mergeLockCli({ repo, sha, author: 'viecganban-bot', reviews: rv, cache })), 0)
  assert.equal(await quiet(() => mergeLockCli({ repo, sha, author: 'viecganban-bot', reviews: rv, cache })), 0)
  assert.equal(wc.compareCalls.length, 1, 'B3 CLI: 같은 봇 실행의 두 PR은 compare 기억 파일을 공유')
  assert.ok(JSON.parse(rf(cache, 'utf8')).length === 1)
  // 봇 병합기 연결: 병합 직전 재확인 뒤·병합 API 앞에서 부르고, 3은 생략·그 밖 실패는 오류 기록 후 보류, 실행 시작 때 기억 초기화
  const yml = rf(new URL('../../.github/workflows/bot-pr-automerge.yml', import.meta.url), 'utf8')
  const at = (s) => { const i = yml.indexOf(s); assert.ok(i >= 0, `봇 워크플로에 ${s.slice(0, 40)} 없음`); return i }
  const recheck = at('병합 직전 재확인에서 승인 상태가 바뀜'), call = at('approval-checks.mjs --merge-lock-check'), merge = at('merge_out=$(gh api -X PUT')
  const gateRead = at('merge-gate-ready.jq')
  assert.ok(recheck < call && gateRead < call && call < merge, 'B3: 잠금 재확인은 승인 재확인·병합 조건 검사 뒤, 병합 API 바로 앞')
  assert.match(yml.slice(call, merge), /--reviews reviews\.json --cache lock-cache\.json/)
  assert.match(yml.slice(call, merge), /lock_rc" = 3[\s\S]*?continue[\s\S]*?lock_rc" != 0[\s\S]*?::error::[\s\S]*?GITHUB_STEP_SUMMARY[\s\S]*?continue/, 'B3: 잠금은 생략, 조회 실패는 오류 기록 후 보류')
  assert.ok(at('rm -f lock-cache.json') < recheck, 'B3: 실행 시작 때 기억 파일 초기화')
  // (독립 검토 지적 1) 실제 프로세스 종료 코드: 반환값이 아니라 CLI가 0·3·4로 끝나는지 — fetch를 흉내 내는 --import 모듈로 네트워크 없이
  const { spawnSync } = await import('node:child_process')
  const script = new URL('./approval-checks.mjs', import.meta.url).pathname
  const mock = join(dir, 'mock.mjs')
  wf(mock, `const mode = process.env.B3_MOCK
globalThis.fetch = async (url) => { const u = String(url)
  const res = (d, s = 200) => ({ ok: s < 400, status: s, json: async () => d, text: async () => JSON.stringify(d) })
  if (/issues\\?state=open/.test(u)) return mode === 'fail' ? res({}, 403) : res(mode === 'lock' && u.includes('page=1') ? [{ number: 77, state: 'open', title: '운영 배포 검증 실패: abc1234', user: { login: 'github-actions[bot]' } }] : [])
  if (/deploy-verify\\.yml\\/runs/.test(u)) return res({ workflow_runs: [] })
  return res({}, 404) }
`)
  const run = (mode, extra = {}) => spawnSync(process.execPath, ['--import', mock, script, '--merge-lock-check', '--repo', repo, '--sha', sha, '--author', 'viecganban-bot', '--reviews', rv], { encoding: 'utf8', env: { ...process.env, B3_MOCK: mode, GITHUB_TOKEN: 't', ...extra } })
  assert.equal(run('none').status, 0, 'B3 프로세스: 잠금 없음 → 종료 0')
  assert.equal(run('lock').status, 3, 'B3 프로세스: 잠금 → 종료 3(0이면 봇이 잠금 중 병합 — 열린 실패)')
  assert.equal(run('none', { GITHUB_TOKEN: '' }).status, 4, 'B3 프로세스: 토큰 없음 → 종료 4(보류)')
  // 조회 실패(403) 재시도·보류는 대기(10초×2)를 피하려고 위 함수 시험(재시도 횟수·대기 횟수까지)에서 본다
  // (독립 검토 지적 2) 봇 워크플로의 셸 조각을 그대로 꺼내 bash로 실제 실행: set -euo pipefail 아래 종료 코드 처리·continue·실행 요약 기록
  const mergeLine = yml.lastIndexOf('\n', merge)  // 병합 API 줄('if merge_out=…') 바로 앞까지
  const seg = yml.slice(yml.lastIndexOf('lock_rc=0', merge), mergeLine).replace(/^ {12}/gm, '')
  const bin = join(dir, 'b3bin'); (await import('node:fs')).mkdirSync(bin)
  wf(join(bin, 'node'), '#!/bin/sh\necho "가짜 판정 $FAKE_RC"\nexit "$FAKE_RC"\n'); (await import('node:fs')).chmodSync(join(bin, 'node'), 0o755)
  const sh = (rc) => { const summary = join(dir, `summary-${rc}.md`); wf(summary, '')
    const r = spawnSync('bash', ['-c', `set -euo pipefail\nREPO=o/r; GH_TOKEN=t; author=a; sha=${sha}\nfor num in 1 2; do\n${seg}\necho "MERGE_REACHED $num"\ndone\necho LOOP_DONE`], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_RC: String(rc), GITHUB_STEP_SUMMARY: summary } })
    return { code: r.status, out: r.stdout, summary: rf(summary, 'utf8') } }
  let o = sh(0); assert.deepEqual([o.code, /MERGE_REACHED 1/.test(o.out), /MERGE_REACHED 2/.test(o.out)], [0, true, true], 'B3 셸: 종료 0 → 병합 단계로 진행')
  o = sh(3); assert.deepEqual([o.code, /MERGE_REACHED/.test(o.out), /LOOP_DONE/.test(o.out)], [0, false, true], 'B3 셸: 종료 3 → 이 PR 병합 생략, 다음 PR로 계속(단계 전체가 멈추지 않음)')
  assert.match(o.out, /::notice::PR #1 가짜 판정 3/)
  o = sh(4); assert.deepEqual([o.code, /MERGE_REACHED/.test(o.out), /LOOP_DONE/.test(o.out)], [0, false, true], 'B3 셸: 종료 4 → 보류, 다음 PR로 계속')
  assert.match(o.out, /::error::PR #1 병합 직전 운영 배포 잠금 재확인 실패\(코드 4\)/); assert.match(o.summary, /PR #1 운영 배포 잠금 재확인 실패 — 병합 보류/)
  o = sh(1); assert.equal(/MERGE_REACHED/.test(o.out), false, 'B3 셸: 예상 밖 종료 코드(1)도 보류 — 실패를 통과로 보지 않음')
}
console.log('approval-checks main: S1 B3 병합 직전 잠금 재확인 시험 통과')

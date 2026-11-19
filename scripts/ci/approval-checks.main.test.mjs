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
  // 두 PR 모두 승인·보고가 있으면 통과
  const w2 = world({ prs: [pr(1), pr(2)], reviews: { 1: [leeOk], 2: [leeOk] }, comments: { 1: [claudeOk], 2: [claudeOk] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.equal(last(w2.writes, 'approval-gate').state, 'success')
  // 한쪽만 4대 보고가 없으면 failure(가장 나쁜 쪽)
  const w3 = world({ prs: [pr(1), pr(2, { body: '' })], reviews: { 1: [leeOk], 2: [leeOk] }, comments: { 1: [claudeOk], 2: [claudeOk] } })
  await main(['--repo', repo, '--pr', '2'], opts)
  assert.equal(last(w3.writes, 'approval-gate').state, 'failure', '보고 없는 PR이 섞이면 실패')
  // 검토 결과가 한쪽 PR에만 있어도(다른 PR은 없음) ai-review는 success가 아님
  const w4 = world({ prs: [pr(1), pr(2)], reviews: { 1: [leeOk], 2: [leeOk] }, comments: { 1: [claudeOk], 2: [] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.notEqual(last(w4.writes, 'ai-review').state, 'success', '독립 검토가 없는 PR이 섞이면 success 아님')
}

// ② 수집 실패: 이미 success였던 두 검사가 pending으로 내려가고 마지막은 failure — success로 남지 않는다
{
  const w = world({ prs: [pr(1)], reviews: { 1: [leeOk] }, comments: { 1: [claudeOk] }, existing: { 'ai-review': { id: 101, state: 'success' }, 'approval-gate': { id: 102, state: 'success' } }, failFiles: true })
  await assert.rejects(() => main(['--repo', repo, '--pr', '1'], opts), /재판정 실패/, '실행은 실패로 끝남')
  for (const n of ['ai-review', 'approval-gate']) {
    const mine = w.writes.filter((x) => x.name === n)
    assert.equal(mine[0].state, 'in_progress', `${n}: 수집 전에 대기로 내림`)
    assert.equal(mine.at(-1).state, 'failure', `${n}: 마지막은 실패`)
    assert.equal(w.runs[n].state, 'failure', `${n}: 남은 결과가 success가 아님`)
    assert.ok(!mine.some((x) => x.state === 'success'))
  }
  // 정상이면 pending → success 로 돌아온다
  const ok = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments: { 1: [claudeOk] } })
  await main(['--repo', repo, '--pr', '1'], opts)
  assert.equal(ok.writes.filter((x) => x.name === 'ai-review')[0].state, 'in_progress'); assert.equal(last(ok.writes, 'ai-review').state, 'success')
}
// ③ 동시 실행 순서 뒤바뀜(Codex P1): 오래된 실행 A가 자료를 모은 뒤 멈춰 있는 동안, 새 지적을 본 실행 B가 먼저 끝난다. A가 나중에 끝나도 최신 판정(대기)을 success로 덮으면 안 된다.
{
  let startedA, releaseA; const started = new Promise((r) => (startedA = r)), release = new Promise((r) => (releaseA = r))
  const comments = { 1: [claudeOk] }
  const w = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments, gate: { used: false, started: startedA, release } })
  const runA = main(['--repo', repo, '--pr', '1'], opts)          // A: 지적 없는 옛 자료를 쥐고 멈춤
  await started
  comments[1] = [claudeOk, { user: { login: 'claude[bot]' }, body: `<!-- claude-fallback-review -->\nsha: ${sha}\nfindings: 2\n\n지적`, created_at: '2026-11-15T10:30:00Z' }]
  await main(['--repo', repo, '--pr', '1'], opts)                 // B: 새 지적을 보고 끝까지 실행
  assert.equal(last(w.writes, 'ai-review').state, 'in_progress', 'B 뒤: 지적에 답이 없어 대기')
  releaseA(); await runA                                          // A가 뒤늦게 끝남
  assert.notEqual(last(w.writes, 'ai-review').state, 'success', '오래된 실행이 늦게 끝나도 최신 판정을 success로 덮지 못함')
  assert.equal(last(w.writes, 'ai-review').state, 'in_progress', '마지막 판정은 대기(실패 판정 유지)')
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
  const w = world({ prs: [pr(1, { body: 'x' })], reviews: { 1: [] }, comments: { 1: [claudeOk] }, existing: { 'ai-review': { id: 7 } } })
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
  assert.equal(last(w.writes, 'ai-review').state, 'success', '권한 밖 403 가짜에서도 검사 게시 완료')
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

// S4 8단계 재현 시험(Codex P1 2건): GitHub API를 흉내 내어 main()을 실제로 돌린다.
//  ① 같은 head SHA를 쓰는 PR 둘 — 한 PR의 승인이 다른 PR의 미승인 판정을 success로 덮어쓰지 않는다
//  ② 재판정 중 API 조회가 실패하면 이미 있던 success가 남지 않는다(pending → failure)
import assert from 'node:assert/strict'
import { main } from './approval-checks.mjs'
const repo = 'KHOAILANG0926/jobi-app', sha = 'a'.repeat(40), later = '2026-11-15T10:20:00Z'
const body = ['## 고위험 4대 보고', '- 무엇을 바꾸나: 검사 설정 변경', '- 왜 필요한가: 병합 보호 강화', '- 승인 시 남는 위험: 설정 오류 가능', '- 미승인 시 영향: 보호 지연', `- 검증: https://github.com/${repo}/actions/runs/1`].join('\n')
const claudeOk = { user: { login: 'claude[bot]' }, body: `<!-- claude-fallback-review -->\nsha: ${sha}\nfindings: 0\n\nok`, created_at: '2026-11-15T10:05:00Z' }
const leeOk = { user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: sha, submitted_at: later }
const pr = (number, extra = {}) => ({ number, draft: false, state: 'open', base: { ref: 'master', sha: 'b'.repeat(40) }, head: { sha, repo: { full_name: repo } }, user: { login: 'viecganban-bot' }, labels: [], body, ...extra })

function world({ prs, reviews, comments, existing = {}, failFiles = false }) {
  const writes = [], runs = { ...existing }
  const res = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => (typeof data === 'string' ? data : JSON.stringify(data)) })
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('https://api.github.com/', ''), method = init.method ?? 'GET'
    if (method === 'GET') {
      let m
      if (/^repos\/[^/]+\/[^/]+\/pulls\?/.test(path)) return res(path.includes('page=1') ? prs : [])
      if ((m = path.match(/pulls\/(\d+)\/files/))) return failFiles ? res({ message: 'unavailable' }, 503) : res(path.includes('page=1') ? [{ filename: '.github/workflows/x.yml', status: 'modified', patch: '@@\n+x' }] : [])
      if ((m = path.match(/pulls\/(\d+)\/reviews/))) return res(path.includes('page=1') ? (reviews[m[1]] ?? []) : [])
      if (/pulls\/\d+\/comments/.test(path)) return res([])
      if ((m = path.match(/issues\/(\d+)\/comments/))) return res(path.includes('page=1') ? (comments[m[1]] ?? []) : [])
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
  return { writes, runs }
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
// 열린 PR이 아니면 아무것도 올리지 않음
{ const w = world({ prs: [], reviews: {}, comments: {} }); await main(['--repo', repo, '--pr', '9'], opts); assert.equal(w.writes.length, 0) }
console.log('approval-checks main 재현 시험 통과(같은 SHA PR 오염 차단·수집 실패 시 옛 성공 무효)')

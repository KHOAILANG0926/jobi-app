// S4 8단계(Lee 2026-11-15): 병합 조건을 'Claude 앱이 만든 검사 결과 2개'로 GitHub에 남긴다.
//   ai-review      = 독립 검토(Codex 또는 Claude 검토관)가 이 커밋에 대해 끝났고 지적에 답이 있음 (codex-review-gate.mjs와 같은 판정)
//   approval-gate  = 위험도 판정(decision-approval-gate.mjs ①~⑧) — 일반 PR이면 통과, 고위험·판단 불가는 4대 보고 + Lee 공식 Approve(최신 커밋)가 있어야 통과
// 왜 Claude 앱인가: GitHub Actions 앱이 만든 검사는 PR 브랜치 워크플로가 같은 이름으로 흉내 낼 수 있다(GITHUB_TOKEN 'checks: write').
//   Claude 앱 토큰은 claude-code-action과 같은 OIDC 교환이라 저장소 기본 브랜치(master)의 워크플로에만 발급된다(claude-publish.mjs 머리말).
//   그래서 master 보호 규칙에서 이 두 검사를 '출처 앱 = Claude'로 필수 지정하면 PR 쪽 코드는 통과를 만들 수 없다(대표님 GitHub 설정, 코드는 설정을 바꾸지 않는다).
// 이 스크립트는 PR 코드를 받지도 실행하지도 않는다: GitHub API 데이터만 읽고 master 코드로 판정한다.
// 사용: node approval-checks.mjs --repo o/r (--pr N | --all) [--dry-run]
import { decisionApproval, approvedFramePaths } from '../decision-approval-gate.mjs'
import { codexGate } from '../codex-review-gate.mjs'
import { appToken } from './claude-publish.mjs'
import { readFileSync } from 'node:fs'

export const CHECK_REVIEW = 'ai-review'
export const CHECK_APPROVAL = 'approval-gate'

/** 두 검사의 판정(순수 함수). state: success | pending(진행 중) | blocked(Lee 행동 필요) | failure */
export function verdicts({ files, reviews, reviewComments, comments, labels, deps = {}, sha, headDate, body, author, repo, framePaths, now = new Date() }) {
  let review
  try {
    const names = files.map((f) => f.filename)
    const g = codexGate({ reviews, reviewComments, comments, sha, headDate, files: names, now })
    review = g.ok ? { state: 'success', summary: g.reason } : g.reviewerBroken ? { state: 'failure', summary: g.reason } : { state: 'pending', summary: g.reason }
  } catch (e) { review = { state: 'failure', summary: `독립 검토 판정 오류(닫힌 실패): ${String(e.message).slice(0, 120)}` } }
  let approval
  try {
    const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths, deps, author, body, repo })
    if (!r.required) approval = { state: 'success', summary: '일반 PR(위험도 normal): Lee 승인 불필요' }
    else if (r.approved) approval = { state: 'success', summary: `${r.risk === 'unknown' ? '위험도 판단 불가' : '고위험'}(${r.reasons.join('·')}): 4대 보고 + Lee 승인(최신 커밋) 확인` }
    else if (!r.report.ok) approval = { state: 'failure', summary: `${r.reasons.join('·')} 대상 — PR 본문 "## 고위험 4대 보고" 부족: ${r.report.missing.join(', ')}` }
    else approval = { state: 'blocked', summary: `${r.reasons.join('·')} 대상 — Lee의 공식 Approve(이 커밋) 대기` }
  } catch (e) { approval = { state: 'failure', summary: `위험도 판정 오류(닫힌 실패): ${String(e.message).slice(0, 120)}` } }
  return { review, approval }
}

const ghFetch = async (token, path, accept = 'application/vnd.github+json') => {
  const r = await fetch(`https://api.github.com/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: accept } })
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`)
  return accept.includes('raw') ? r.text() : r.json()
}
const pages = async (token, path) => {
  const out = []
  for (let p = 1; p < 60; p++) {
    const part = await ghFetch(token, `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${p}`)
    out.push(...part)
    if (part.length < 100) break
  }
  return out
}

async function collect(token, repo, num, framePaths) {
  const pr = await ghFetch(token, `repos/${repo}/pulls/${num}`)
  const sha = pr.head.sha
  const [files, reviews, reviewComments, comments] = await Promise.all([pages(token, `repos/${repo}/pulls/${num}/files`), pages(token, `repos/${repo}/pulls/${num}/reviews`), pages(token, `repos/${repo}/pulls/${num}/comments`), pages(token, `repos/${repo}/issues/${num}/comments`)])
  const commit = await ghFetch(token, `repos/${repo}/commits/${sha}`)
  const labels = pr.labels.map((l) => l.name)
  let deps = {}
  if (files.some((f) => f.filename === 'package.json' || f.filename === 'package-lock.json')) {
    try {
      const raw = (p, ref) => ghFetch(token, `repos/${repo}/contents/${p}?ref=${ref}`, 'application/vnd.github.raw').then(JSON.parse)
      deps = { basePkg: await raw('package.json', pr.base.sha), headPkg: await raw('package.json', sha), baseLock: await raw('package-lock.json', pr.base.sha), headLock: await raw('package-lock.json', sha) }
    } catch { deps = {} }  // 못 받으면 빈 값 → 판정기가 '판단 불가'(닫힌 실패)
  }
  return { pr, input: { files, reviews, reviewComments, comments, labels, deps, sha, headDate: commit.commit.committer.date, body: pr.body ?? '', author: pr.user?.login ?? '', repo, framePaths } }
}

/** 이 앱이 이 커밋에 이미 올린 같은 이름 검사가 있으면 갱신, 없으면 만든다. 커밋이 그 사이 바뀌었으면(옛 커밋 판정) 올리지 않는다. */
export async function publish(appTok, repo, num, sha, name, v) {
  const live = await ghFetch(appTok, `repos/${repo}/pulls/${num}`)
  if (live.head.sha !== sha) { console.log(`PR #${num}: 판정하는 사이 새 커밋 — ${name} 올리지 않음`); return 'stale' }
  const base = { name, head_sha: sha, output: { title: `${name}: ${v.state}`, summary: v.summary.slice(0, 1000) } }
  const payload = v.state === 'success' ? { ...base, status: 'completed', conclusion: 'success' }
    : v.state === 'pending' ? { ...base, status: 'in_progress' }
      : { ...base, status: 'completed', conclusion: v.state === 'blocked' ? 'action_required' : 'failure' }
  const found = await ghFetch(appTok, `repos/${repo}/commits/${sha}/check-runs?check_name=${name}&per_page=100`)
  const mine = found.check_runs.filter((c) => c.app?.slug === 'claude').sort((a, b) => b.id - a.id)[0]
  const r = await fetch(`https://api.github.com/repos/${repo}/check-runs${mine ? `/${mine.id}` : ''}`, { method: mine ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${appTok}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error(`${name} 검사 올리기 실패 ${r.status} ${(await r.text()).slice(0, 200)}`)
  return 'ok'
}

export async function main(argv) {
  const a = {}
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k === '--dry-run' || k === '--all') a[k.slice(2)] = true; else a[k.slice(2)] = argv[++i] }
  const repo = a.repo, readTok = process.env.GITHUB_TOKEN
  if (!repo || !readTok || (!a.pr && !a.all)) throw new Error('사용: --repo o/r (--pr N | --all), 환경변수 GITHUB_TOKEN(읽기)')
  const framePaths = approvedFramePaths(readFileSync(new URL('../test-desktop-baseline.mjs', import.meta.url), 'utf8'))
  const nums = a.pr ? [Number(a.pr)] : (await pages(readTok, `repos/${repo}/pulls?state=open&base=master`)).filter((p) => !p.draft && p.number >= 251 && p.head.repo?.full_name === repo).map((p) => p.number)
  let appTok = null
  for (const num of nums) {
    const { pr, input } = await collect(readTok, repo, num, framePaths)
    if (pr.state !== 'open' || pr.base.ref !== 'master' || pr.head.repo?.full_name !== repo) { console.log(`PR #${num}: 대상 아님`); continue }
    const v = verdicts(input)
    console.log(`PR #${num} ${input.sha.slice(0, 7)}: ${CHECK_REVIEW}=${v.review.state}(${v.review.summary}) ${CHECK_APPROVAL}=${v.approval.state}(${v.approval.summary})`)
    if (a['dry-run']) continue
    appTok ??= await appToken()
    await publish(appTok, repo, num, input.sha, CHECK_REVIEW, v.review)
    await publish(appTok, repo, num, input.sha, CHECK_APPROVAL, v.approval)
  }
}

if (process.argv[1]?.endsWith('approval-checks.mjs')) main(process.argv.slice(2)).catch((e) => { console.error(`::error::${e.message}`); process.exit(1) })

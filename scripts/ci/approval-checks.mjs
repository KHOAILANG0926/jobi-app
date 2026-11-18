// S4 8단계(Lee 2026-11-15): 병합 조건을 '검사 전용 앱(viecganban-checks)이 만든 검사 결과 2개'로 GitHub에 남긴다.
//   ai-review      = 독립 검토(Codex 또는 Claude 검토관)가 이 커밋에 대해 끝났고 지적에 답이 있음 (codex-review-gate.mjs와 같은 판정)
//   approval-gate  = 위험도 판정(decision-approval-gate.mjs ①~⑧) — 일반 PR이면 통과, 고위험·판단 불가는 4대 보고 + Lee 공식 Approve(최신 커밋)가 있어야 통과
// 왜 별도 앱인가: GitHub Actions 앱이 만든 검사는 PR 브랜치 워크플로가 같은 이름으로 흉내 낼 수 있다(GITHUB_TOKEN 'checks: write').
//   검사 전용 앱 열쇠는 운영 열쇠 환경 ops-keys(master만, secret-isolation R8)에만 있어 master 사본 작업만 토큰을 만든다(2026-11-16: Claude 앱 교환은 checks 발급 불가 — run 43797922253).
//   그래서 master 보호 규칙에서 이 두 검사를 '출처 앱 = viecganban-checks'로 필수 지정하면 PR 쪽 코드는 통과를 만들 수 없다(대표님 GitHub 설정, 코드는 설정을 바꾸지 않는다).
// 이 스크립트는 PR 코드를 받지도 실행하지도 않는다: GitHub API 데이터만 읽고 master 코드로 판정한다.
// 사용: node approval-checks.mjs --repo o/r (--pr N | --all) [--dry-run]
import { decisionApproval, approvedFramePaths, leeApprovedAt } from '../decision-approval-gate.mjs'
import { codexGate } from '../codex-review-gate.mjs'
import { readFileSync } from 'node:fs'

export const CHECK_REVIEW = 'ai-review'
export const CHECK_APPROVAL = 'approval-gate'

/**
 * 운영 배포 잠금(S6, #808 S2 설계 4절 ⑤): deploy-verify.yml이 실패하면 만드는 '운영 배포 검증 실패: <커밋 7자리>' 이슈가 열려 있는 동안
 * 일반 PR의 approval-gate를 'Lee 승인 필요'로 올린다(자동 병합 잠금). 새 장치가 아니라 기존 이슈를 잠금 표시로 쓴다.
 * 작성자가 github-actions[bot](deploy-verify의 GITHUB_TOKEN)인 이슈만 센다 — 다른 사람이 같은 제목으로 열어 병합을 막지 못하게.
 * 해제: master에서 가장 최근에 성공한 deploy-verify 실행의 커밋이 실패 커밋을 포함하면(compare ahead·identical) 그 이슈는 잠금이 아니다(재실행 성공 포함).
 *   deploy-verify.yml은 STRICT 파일(check-repository-policy)이라 고치지 않고, 풀림 판정도 여기 한 곳에서 한다. 이슈를 닫아도 풀린다.
 * 복구 PR은 Lee Approve(최신 커밋)로 통과.
 */
export const LOCK_TITLE = /^운영 배포 검증 실패: ([0-9a-f]{7,40})\b/
export function deployLocks(issues = []) {
  return issues.filter((i) => i && !i.pull_request && i.state === 'open' && i.user?.login === 'github-actions[bot]' && LOCK_TITLE.test(i.title ?? ''))
    .map((i) => ({ number: i.number, sha: LOCK_TITLE.exec(i.title)[1] }))
}

/** 열린 잠금 이슈 중 아직 풀리지 않은 것(위 설명). 조회가 실패하면 예외 → 호출한 곳이 닫힌 실패로 올린다. */
export async function activeLocks(token, repo) {
  const locks = deployLocks(await pages(token, `repos/${repo}/issues?state=open&creator=${encodeURIComponent('github-actions[bot]')}`))
  if (!locks.length) return []
  const ok = (await ghFetch(token, `repos/${repo}/actions/workflows/deploy-verify.yml/runs?branch=master&status=success&per_page=1`)).workflow_runs?.[0]?.head_sha
  if (!ok) return locks
  const still = []
  for (const l of locks) {
    const st = (await ghFetch(token, `repos/${repo}/compare/${l.sha}...${ok}`)).status
    if (st !== 'ahead' && st !== 'identical') still.push(l)
  }
  return still
}

/** 두 검사의 판정(순수 함수). state: success | pending(진행 중) | blocked(Lee 행동 필요) | failure */
export function verdicts({ files, reviews, reviewComments, comments, labels, deps = {}, sha, headDate, body, author, repo, framePaths, locks = [], now = new Date() }) {
  let review
  try {
    const names = files.map((f) => f.filename)
    const g = codexGate({ reviews, reviewComments, comments, sha, headDate, files: names, now })
    review = g.ok ? { state: 'success', summary: g.reason } : g.reviewerBroken ? { state: 'failure', summary: g.reason } : { state: 'pending', summary: g.reason }
  } catch (e) { review = { state: 'failure', summary: `독립 검토 판정 오류(닫힌 실패): ${String(e.message).slice(0, 120)}` } }
  let approval
  try {
    const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths, deps, author, body, repo })
    const lock = locks.length ? `운영 배포 검증 실패 이슈 ${locks.map((l) => `#${l.number}(${l.sha.slice(0, 7)})`).join('·')} 열림` : ''
    if (!r.required && lock) approval = leeApprovedAt(reviews, sha, author)
      ? { state: 'success', summary: `${lock} — 일반 PR 자동 병합 잠금 중, Lee 승인(최신 커밋)이 있어 통과(복구 PR)` }
      : { state: 'blocked', summary: `${lock} — 일반 PR 자동 병합 잠금(S6). 풀림: 그 커밋을 포함한 master에서 deploy-verify 성공(재실행 포함)·이슈 닫기, 또는 이 PR에 Lee Approve(이 커밋)` }
    else if (!r.required) approval = { state: 'success', summary: '일반 PR(위험도 normal): Lee 승인 불필요' }
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

async function collect(token, repo, num, framePaths, locks = []) {
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
  return { pr, input: { files, reviews, reviewComments, comments, labels, deps, sha, headDate: commit.commit.committer.date, body: pr.body ?? '', author: pr.user?.login ?? '', repo, framePaths, locks } }
}

/** 이 앱이 이 커밋에 이미 올린 같은 이름 검사가 있으면 갱신, 없으면 만든다. 커밋이 그 사이 바뀌었으면(옛 커밋 판정) 올리지 않는다.
 *  검사 전용 앱 토큰은 checks 권한만 있으므로 PR 조회는 읽기 토큰(GITHUB_TOKEN, pull-requests: read)으로 한다 — 앱 토큰은 check-runs 조회·생성·갱신에만 쓴다(검토관 지적 1854918).
 *  고칠 대상은 이 검사 전용 앱이 만든 검사만(CHECKS_APP_SLUG) — 다른 앱·GitHub Actions가 만든 같은 이름 검사는 건드리지 않는다. */
export async function publish(appTok, repo, num, sha, name, v, readTok = appTok) {
  const live = await ghFetch(readTok, `repos/${repo}/pulls/${num}`)
  if (live.head.sha !== sha) { console.log(`PR #${num}: 판정하는 사이 새 커밋 — ${name} 올리지 않음`); return 'stale' }
  const base = { name, head_sha: sha, output: { title: `${name}: ${v.state}`, summary: v.summary.slice(0, 1000) } }
  const payload = v.state === 'success' ? { ...base, status: 'completed', conclusion: 'success' }
    : v.state === 'pending' ? { ...base, status: 'in_progress' }
      : { ...base, status: 'completed', conclusion: v.state === 'blocked' ? 'action_required' : 'failure' }
  const found = await ghFetch(appTok, `repos/${repo}/commits/${sha}/check-runs?check_name=${name}&per_page=100`)
  const mine = found.check_runs.filter((c) => c.app?.slug === checksAppSlug()).sort((a, b) => b.id - a.id)[0]
  const r = await fetch(`https://api.github.com/repos/${repo}/check-runs${mine ? `/${mine.id}` : ''}`, { method: mine ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${appTok}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error(`${name} 검사 올리기 실패 ${r.status} ${(await r.text()).slice(0, 200)}`)
  return 'ok'
}

// 같은 커밋을 쓰는 PR이 여럿이면 검사 결과(커밋당 이름당 하나)는 공유된다 → 가장 나쁜 판정을 올린다(Codex P1: 한 PR의 승인이 다른 PR의 미승인을 덮어쓰지 않게).
const SEVERITY = { success: 0, pending: 1, blocked: 2, failure: 3 }
export function combine(list) {
  const w = list.reduce((a, b) => (SEVERITY[b.v.state] > SEVERITY[a.v.state] ? b : a))
  return list.length === 1 ? w.v : { state: w.v.state, summary: `같은 커밋을 쓰는 PR ${list.map((x) => `#${x.num}`).join('·')} 중 가장 나쁜 판정 — #${w.num}: ${w.v.summary}` }
}

// 검사 결과는 검사 전용 GitHub 앱(Checks 쓰기만)으로 올린다(S4 B단계, Lee 2026-11-16).
// Anthropic 교환은 checks:write를 내주지 않음(run 43797922253 401) → 워크플로가 운영 열쇠 환경 ops-keys(master만)의 비밀값으로 만든 토큰을 환경변수로 넘긴다.
// 토큰·앱 이름이 없으면 예외 → 실행 실패(닫힌 실패, 성공 표시 없음).
function checksAppSlug() { const s = process.env.CHECKS_APP_SLUG; if (!s) throw new Error('검사 전용 앱 이름 없음(CHECKS_APP_SLUG)'); return s }
export function checksAppToken() {
  const t = process.env.CHECKS_APP_TOKEN
  if (!t) throw new Error('검사 전용 앱 토큰 없음(CHECKS_APP_TOKEN — ops-keys 환경의 APPROVAL_CHECKS_APP_ID·APPROVAL_CHECKS_APP_KEY 확인)')
  checksAppSlug()
  return t
}

export async function main(argv, { getAppToken = checksAppToken, framePaths: fp } = {}) {
  const a = {}
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k === '--dry-run' || k === '--all') a[k.slice(2)] = true; else a[k.slice(2)] = argv[++i] }
  const repo = a.repo, readTok = process.env.GITHUB_TOKEN
  if (!repo || !readTok || (!a.pr && !a.all)) throw new Error('사용: --repo o/r (--pr N | --all), 환경변수 GITHUB_TOKEN(읽기)')
  const framePaths = fp ?? approvedFramePaths(readFileSync(new URL('../test-desktop-baseline.mjs', import.meta.url), 'utf8'))
  const open = (await pages(readTok, `repos/${repo}/pulls?state=open&base=master`)).filter((p) => p.base?.ref === 'master' && p.head.repo?.full_name === repo)
  // --all은 열린 PR 전체(Draft 제외)를 다시 판정하고, --pr을 함께 주면 그 PR(Draft 포함)도 넣는다. 워크플로는 항상 둘을 함께 써서(직렬 실행) 건너뛴 실행이 있어도 다음 실행이 전체를 최신 자료로 덮는다.
  const eligible = open.filter((p) => !p.draft && p.number >= 251)
  const targets = a.all ? [...new Map([...eligible, ...open.filter((p) => a.pr && p.number === Number(a.pr))].map((p) => [p.number, p])).values()] : open.filter((p) => p.number === Number(a.pr))
  if (a.pr && !targets.length) { console.log(`PR #${a.pr}: 열린 PR 아님(대상 아님)`); return }
  let appTok = null, errors = 0
  for (const sha of new Set(targets.map((p) => p.head.sha))) {
    const group = open.filter((p) => p.head.sha === sha)
    const nums = group.map((p) => p.number)
    const post = async (name, v) => { appTok ??= await getAppToken(); return publish(appTok, repo, nums[0], sha, name, v, readTok) }
    try {
      // 재판정을 시작하기 전에 이 커밋의 기존 판정을 '대기'로 내린다 — 아래 수집이 중간에 끊겨도 옛 성공이 남지 않는다(Codex P1).
      if (!a['dry-run']) for (const name of [CHECK_REVIEW, CHECK_APPROVAL]) await post(name, { state: 'pending', summary: '재판정 중(이전 판정은 무효)' })
      // 판정은 두 번 한다: 게시 직전에 자료를 다시 모아 다시 판정하고 더 나쁜 쪽을 올린다(Codex P1: 오래된 실행이 늦게 끝나 최신 판정을 success로 덮지 못하게).
      // 워크플로의 직렬 실행(concurrency 한 줄)이 1차 방어, 이 재판정이 2차 방어 — 둘 다 기존 승인 검사 안에서만.
      const evaluate = async () => {
        const list = []
        // 잠금 이슈는 판정마다 새로 읽는다(두 번 판정하는 사이 잠금이 생겨도 더 나쁜 쪽이 올라감). 못 읽으면 예외 → 닫힌 실패.
        const locks = await activeLocks(readTok, repo)
        for (const p of group) { const { input } = await collect(readTok, repo, p.number, framePaths, locks); list.push({ num: p.number, v: verdicts(input) }) }
        return { review: combine(list.map((x) => ({ num: x.num, v: x.v.review }))), approval: combine(list.map((x) => ({ num: x.num, v: x.v.approval }))) }
      }
      const first = await evaluate(), second = await evaluate()
      const worse = (x, y) => (SEVERITY[y.state] > SEVERITY[x.state] ? y : x)
      const review = worse(first.review, second.review), approval = worse(first.approval, second.approval)
      console.log(`PR ${nums.map((n) => `#${n}`).join('·')} ${sha.slice(0, 7)}: ${CHECK_REVIEW}=${review.state}(${review.summary}) ${CHECK_APPROVAL}=${approval.state}(${approval.summary})`)
      if (a['dry-run']) continue
      await post(CHECK_REVIEW, review); await post(CHECK_APPROVAL, approval)
    } catch (e) {
      // 수집·판정이 실패하면 두 검사를 실패로 올린다(닫힌 실패) — 못 올리면 이 실행이 실패로 끝나 다음 실행이 다시 시도한다.
      errors++
      console.error(`::error::PR ${nums.join(',')} ${sha.slice(0, 7)} 재판정 실패: ${e.message}`)
      if (!a['dry-run']) for (const name of [CHECK_REVIEW, CHECK_APPROVAL]) { try { await post(name, { state: 'failure', summary: `재판정 수집 실패(닫힌 실패): ${String(e.message).slice(0, 150)}` }) } catch (e2) { console.error(`::error::${name} 실패 표시도 못 올림: ${e2.message}`) } }
    }
  }
  if (errors) throw new Error(`${errors}개 커밋 재판정 실패`)
}

if (process.argv[1]?.endsWith('approval-checks.mjs')) main(process.argv.slice(2)).catch((e) => { console.error(`::error::${e.message}`); process.exit(1) })

// S4 8단계(Lee 2026-11-15): 병합 조건을 '검사 전용 앱(viecganban-checks)이 만든 검사 결과'로 GitHub에 남긴다(11-21부터 approval-gate 하나).
//   (ai-review 검사는 Lee 2026-11-21 독립 검토를 병합 조건에서 빼고 Ruleset에서도 뺀 뒤 지웠다 — 지금은 approval-gate 하나만 올린다.)
//   approval-gate  = 위험도 판정(decision-approval-gate.mjs ①~⑧) — 일반 PR이면 통과, 고위험·판단 불가는 Lee 공식 Approve(최신 커밋)가 있어야 통과(4대 보고 강제는 11-21 폐지)
// 왜 별도 앱인가: GitHub Actions 앱이 만든 검사는 PR 브랜치 워크플로가 같은 이름으로 흉내 낼 수 있다(GITHUB_TOKEN 'checks: write').
//   검사 전용 앱 열쇠는 운영 열쇠 환경 ops-keys(master만, secret-isolation R8)에만 있어 master 사본 작업만 토큰을 만든다(2026-11-16: Claude 앱 교환은 checks 발급 불가 — run 43797922253).
//   그래서 master 보호 규칙에서 이 검사를 '출처 앱 = viecganban-checks'로 필수 지정하면 PR 쪽 코드는 통과를 만들 수 없다(대표님 GitHub 설정, 코드는 설정을 바꾸지 않는다).
// 이 스크립트는 PR 코드를 받지도 실행하지도 않는다: GitHub API 데이터만 읽고 master 코드로 판정한다.
// 사용: node approval-checks.mjs --repo o/r (--pr N | --all) [--dry-run]
//       node approval-checks.mjs --merge-lock-check --repo o/r --sha S --author A --reviews reviews.json [--cache 파일]  (S1 B3: 봇 병합 직전 잠금 재확인, 종료 코드 0·3·4)
import { decisionApproval, approvedFramePaths, leeApprovedAt } from '../decision-approval-gate.mjs'
import { readFileSync, writeFileSync } from 'node:fs'

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

/** 열린 잠금 이슈 중 아직 풀리지 않은 것(위 설명). 조회가 실패하면 예외 → 호출한 곳이 닫힌 실패로 올린다.
 * compares: 한 실행 안에서 같은 (실패 커밋, 성공 커밋) 비교를 다시 묻지 않는 기억(두 커밋의 관계는 바뀌지 않음).
 * 없이 PR마다·두 번씩 다시 물으면 열린 잠금 이슈 7건 × PR 10건 × 2 = 140번/5분 → 저장소 GITHUB_TOKEN 한도(시간당 1000번)를 넘겨
 * 다른 PR 재판정·검토관이 403으로 실패했다(2026-11-19 00:19Z run 44427471670·44428216361). */
export async function activeLocks(token, repo, compares = new Map()) {
  const locks = deployLocks(await pages(token, `repos/${repo}/issues?state=open&creator=${encodeURIComponent('github-actions[bot]')}`))
  if (!locks.length) return []
  const ok = (await ghFetch(token, `repos/${repo}/actions/workflows/deploy-verify.yml/runs?branch=master&status=success&per_page=1`)).workflow_runs?.[0]?.head_sha
  if (!ok) return locks
  const still = []
  for (const l of locks) {
    const key = `${l.sha}...${ok}`
    if (!compares.has(key)) compares.set(key, (await ghFetch(token, `repos/${repo}/compare/${key}`)).status)
    const st = compares.get(key)
    if (st !== 'ahead' && st !== 'identical') still.push(l)
  }
  return still
}

/** S1 B3(#808): 봇 병합 직전 운영 배포 잠금 재확인 — approval-gate 판정과 병합 사이 공백(실제 2시간 4분, #943 10:49 → 첫 반영 12:53) 보완.
 * 새 판정이 아니라 위 activeLocks를 그대로 다시 부른다. 잠금 이슈·최신 deploy-verify 성공 기록은 부를 때마다 새로 읽고,
 * 기억(cache)하는 것은 compare 결과(두 커밋의 포함 관계 — 바뀌지 않음)뿐이며 한 번의 봇 실행 안에서만 쓴다 → 오래된 기억으로 '잠금 없음'이 되지 않는다.
 * 조회 실패(403·네트워크 등)는 최대 retries회만 다시 시도하고, 끝내 실패하면 'error'(병합 보류)로 돌려준다 — 실패를 '잠금 없음'으로 보지 않는다(닫힌 실패).
 * 잠금 중 예외는 approval-gate와 같은 기준: 이 커밋에 대한 Lee의 유효한 Approve(leeApprovedAt)가 있으면 통과(복구 PR). */
export async function mergeLockDecision({ token, repo, sha, author, reviews = [], compares = new Map(), retries = 2, waitMs = 10000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let locks, lastError, attempts = 0
  for (let i = 0; i <= retries; i++) {
    attempts++
    try { locks = await activeLocks(token, repo, compares); break } catch (e) { lastError = e; if (i < retries) await sleep(waitMs) }
  }
  if (!locks) return { ok: false, state: 'error', attempts, summary: `운영 배포 잠금 조회 실패(${attempts}회 시도): ${String(lastError?.message ?? lastError).replace(/\s+/g, ' ').slice(0, 160)} — 병합 보류(닫힌 실패)` }  // 한 줄로(봇이 이 글을 로그 명령 줄에 넣음)
  if (!locks.length) return { ok: true, state: 'none', attempts, summary: '운영 배포 잠금 없음' }
  const list = locks.map((l) => `#${l.number}(${l.sha.slice(0, 7)})`).join('·')
  if (leeApprovedAt(reviews, sha, author)) return { ok: true, state: 'lee-approved', attempts, locks, summary: `운영 배포 검증 실패 이슈 ${list} 열림 — Lee 승인(최신 커밋)이 있어 통과(복구 PR)` }
  return { ok: false, state: 'locked', attempts, locks, summary: `운영 배포 검증 실패 이슈 ${list} 열림 — 일반 PR 자동 병합 잠금(S6): 병합 생략` }
}
const readCache = (file) => { try { const t = file && readFileSync(file, 'utf8').trim(); return new Map(t ? JSON.parse(t) : []) } catch { return new Map() } }
/** CLI: --merge-lock-check --repo o/r --sha S --author A --reviews reviews.json [--cache 파일]. 종료 코드 0 통과 · 3 잠금 · 4 조회 실패(병합 보류). */
export async function mergeLockCli(a, opts = {}) {
  const token = process.env.GITHUB_TOKEN
  if (!a.repo || !token || !a.sha || !a.reviews) { console.log('잠금 재확인 인자·토큰 없음 — 병합 보류(닫힌 실패)'); return 4 }
  let reviews
  try { reviews = JSON.parse(readFileSync(a.reviews, 'utf8')) } catch { console.log('리뷰 목록을 읽지 못함 — 병합 보류(닫힌 실패)'); return 4 }
  const compares = readCache(a.cache)
  const d = await mergeLockDecision({ token, repo: a.repo, sha: a.sha, author: a.author ?? '', reviews, compares, ...opts })
  if (a.cache) { try { writeFileSync(a.cache, JSON.stringify([...compares])) } catch { /* 기억 저장 실패는 판정에 영향 없음(다음 호출이 다시 compare) */ } }
  console.log(d.summary)
  return d.ok ? 0 : d.state === 'locked' ? 3 : 4
}

/** approval-gate 판정(순수 함수). state: success | pending(진행 중) | blocked(Lee 행동 필요) | failure */
export function verdicts({ files, reviews, reviewComments, comments, labels, deps = {}, sha, headDate, body, author, repo, framePaths, locks = [], now = new Date() }) {
  let approval
  try {
    const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths, deps, author, body, repo })
    const lock = locks.length ? `운영 배포 검증 실패 이슈 ${locks.map((l) => `#${l.number}(${l.sha.slice(0, 7)})`).join('·')} 열림` : ''
    if (!r.required && lock) approval = leeApprovedAt(reviews, sha, author)
      ? { state: 'success', summary: `${lock} — 일반 PR 자동 병합 잠금 중, Lee 승인(최신 커밋)이 있어 통과(복구 PR)` }
      : { state: 'blocked', summary: `${lock} — 일반 PR 자동 병합 잠금(S6). 풀림: 그 커밋을 포함한 master에서 deploy-verify 성공(재실행 포함)·이슈 닫기, 또는 이 PR에 Lee Approve(이 커밋)` }
    else if (!r.required) approval = { state: 'success', summary: '일반 PR(위험도 normal): Lee 승인 불필요' }
    else if (r.approved) approval = { state: 'success', summary: `${r.risk === 'unknown' ? '위험도 판단 불가' : '고위험'}(${r.reasons.join('·')}): Lee 승인(최신 커밋) 확인` }
    else approval = { state: 'blocked', summary: `${r.reasons.join('·')} 대상 — Lee의 공식 Approve(이 커밋) 대기` }
  } catch (e) { approval = { state: 'failure', summary: `위험도 판정 오류(닫힌 실패): ${String(e.message).slice(0, 120)}` } }
  return { approval }
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
    : v.state === 'neutral' ? { ...base, status: 'completed', conclusion: 'neutral' }
    : v.state === 'pending' ? { ...base, status: 'in_progress' }
      : { ...base, status: 'completed', conclusion: v.state === 'blocked' ? 'action_required' : 'failure' }
  const found = await ghFetch(appTok, `repos/${repo}/commits/${sha}/check-runs?check_name=${name}&per_page=100`)
  const mine = found.check_runs.filter((c) => c.app?.slug === checksAppSlug()).sort((a, b) => b.id - a.id)[0]
  const r = await fetch(`https://api.github.com/repos/${repo}/check-runs${mine ? `/${mine.id}` : ''}`, { method: mine ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${appTok}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error(`${name} 검사 올리기 실패 ${r.status} ${(await r.text()).slice(0, 200)}`)
  return 'ok'
}

// 같은 커밋을 쓰는 PR이 여럿이면 검사 결과(커밋당 이름당 하나)는 공유된다 → 가장 나쁜 판정을 올린다(Codex P1: 한 PR의 승인이 다른 PR의 미승인을 덮어쓰지 않게).
const SEVERITY = { success: 0, neutral: 0, pending: 1, blocked: 2, failure: 3 }
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
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k === '--dry-run' || k === '--all' || k === '--merge-lock-check') a[k.slice(2)] = true; else a[k.slice(2)] = argv[++i] }
  if (a['merge-lock-check']) return mergeLockCli(a)
  const repo = a.repo, readTok = process.env.GITHUB_TOKEN
  if (!repo || !readTok || (!a.pr && !a.all)) throw new Error('사용: --repo o/r (--pr N | --all), 환경변수 GITHUB_TOKEN(읽기)')
  const framePaths = fp ?? approvedFramePaths(readFileSync(new URL('../test-desktop-baseline.mjs', import.meta.url), 'utf8'))
  const open = (await pages(readTok, `repos/${repo}/pulls?state=open&base=master`)).filter((p) => p.base?.ref === 'master' && p.head.repo?.full_name === repo)
  // --all은 열린 PR 전체(Draft 제외)를 다시 판정하고, --pr을 함께 주면 그 PR(Draft 포함)도 넣는다. 워크플로는 항상 둘을 함께 써서(직렬 실행) 건너뛴 실행이 있어도 다음 실행이 전체를 최신 자료로 덮는다.
  const eligible = open.filter((p) => !p.draft && p.number >= 251)
  const targets = a.all ? [...new Map([...eligible, ...open.filter((p) => a.pr && p.number === Number(a.pr))].map((p) => [p.number, p])).values()] : open.filter((p) => p.number === Number(a.pr))
  if (a.pr && !targets.length) { console.log(`PR #${a.pr}: 열린 PR 아님(대상 아님)`); return }
  let appTok = null, errors = 0
  const compares = new Map() // 잠금 풀림 비교 기억(이 실행 동안) — activeLocks 설명
  for (const sha of new Set(targets.map((p) => p.head.sha))) {
    const group = open.filter((p) => p.head.sha === sha)
    const nums = group.map((p) => p.number)
    const post = async (name, v) => { appTok ??= await getAppToken(); return publish(appTok, repo, nums[0], sha, name, v, readTok) }
    try {
      // 재판정을 시작하기 전에 이 커밋의 기존 판정을 '대기'로 내린다 — 아래 수집이 중간에 끊겨도 옛 성공이 남지 않는다(Codex P1).
      if (!a['dry-run']) await post(CHECK_APPROVAL, { state: 'pending', summary: '재판정 중(이전 판정은 무효)' })
      // 판정은 두 번 한다: 게시 직전에 자료를 다시 모아 다시 판정하고 더 나쁜 쪽을 올린다(Codex P1: 오래된 실행이 늦게 끝나 최신 판정을 success로 덮지 못하게).
      // 워크플로의 직렬 실행(concurrency 한 줄)이 1차 방어, 이 재판정이 2차 방어 — 둘 다 기존 승인 검사 안에서만.
      const evaluate = async () => {
        const list = []
        // 잠금 이슈는 판정마다 새로 읽는다(두 번 판정하는 사이 잠금이 생겨도 더 나쁜 쪽이 올라감). 못 읽으면 예외 → 닫힌 실패.
        const locks = await activeLocks(readTok, repo, compares)
        for (const p of group) { const { input } = await collect(readTok, repo, p.number, framePaths, locks); list.push({ num: p.number, v: verdicts(input) }) }
        return { approval: combine(list.map((x) => ({ num: x.num, v: x.v.approval }))) }
      }
      const first = await evaluate(), second = await evaluate()
      const worse = (x, y) => (SEVERITY[y.state] > SEVERITY[x.state] ? y : x)
      const approval = worse(first.approval, second.approval)
      console.log(`PR ${nums.map((n) => `#${n}`).join('·')} ${sha.slice(0, 7)}: ${CHECK_APPROVAL}=${approval.state}(${approval.summary})`)
      if (a['dry-run']) continue
      await post(CHECK_APPROVAL, approval)
    } catch (e) {
      // 수집·판정이 실패하면 approval-gate를 실패로 올린다(닫힌 실패) — 못 올리면 이 실행이 실패로 끝나 다음 실행이 다시 시도한다.
      errors++
      console.error(`::error::PR ${nums.join(',')} ${sha.slice(0, 7)} 재판정 실패: ${e.message}`)
      if (!a['dry-run']) for (const name of [CHECK_APPROVAL]) { try { await post(name, { state: 'failure', summary: `재판정 수집 실패(닫힌 실패): ${String(e.message).slice(0, 150)}` }) } catch (e2) { console.error(`::error::${name} 실패 표시도 못 올림: ${e2.message}`) } }
    }
  }
  if (errors) throw new Error(`${errors}개 커밋 재판정 실패`)
}

if (process.argv[1]?.endsWith('approval-checks.mjs')) main(process.argv.slice(2)).then((c) => { if (typeof c === 'number' && c) process.exit(c) }).catch((e) => { console.error(`::error::${e.message}`); process.exit(1) })

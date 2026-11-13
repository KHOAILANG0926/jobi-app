// R3(#728, Lee 2026-11-13 "병합 보호 및 AI 작업 책임 추적") — 병합된 PR마다 '누가 썼고·누가 실행했고·누가 병합했는지'를 서로 다른 필드로 기록하고,
// AI 이름 표시(꼬리표)는 자기신고로만 취급해 GitHub가 기록한 사실(작성자 계정·병합 계정·병합 경로·필수 검사 최신 결과)과 교차 확인한다. 읽기 전용.
// 알 수 없는 것은 '미확인'으로 남기고 추정하지 않는다. 한계(검증됨 #687): 이 저장소의 자동화·세션은 모두 Lee 계정 열쇠로 움직여
// 병합 계정이 Lee여도 사람이 눌렀는지 AI 세션이 호출했는지는 GitHub 기록만으로 구분되지 않는다.
import { execFileSync } from 'node:child_process'

export const REQUIRED_CHECKS = ['checks', 'guard', 'app-screen'] // 브랜치 보호 master 필수 검사(관리자 권한으로 확인한 값과 같아야 함 — PR #R3 본문 근거)
export const BOT_MERGERS = ['github-actions[bot]']
export const UNKNOWN = '미확인'

/** 커밋 메시지·PR 본문·브랜치에서 AI 작업자 표시(자기신고)를 읽는다. 표시가 없으면 빈 배열. */
export function aiClaims({ commits = [], prBody = '', branch = '' }) {
  const claims = new Map()
  const add = (worker, how) => { const c = claims.get(worker) ?? new Set(); c.add(how); claims.set(worker, c) }
  const scan = (text, where) => {
    const t = String(text ?? '')
    if (/Claude-Session:\s*https:\/\/claude\.ai\/code\/session_/i.test(t) || /Co-Authored-By:\s*Claude/i.test(t) || /Generated (?:with|by) \[Claude Code\]/i.test(t)) add('Claude', where)
    if (/Co-Authored-By:[^\n]*Codex/i.test(t)) add('Codex', where)
    if (/Co-Authored-By:[^\n]*Cursor|Cursor Agent/i.test(t)) add('Cursor', where)
    if (/Co-Authored-By:[^\n]*(?:GPT|ChatGPT|OpenAI)/i.test(t)) add('GPT', where)
  }
  for (const c of commits) scan(c.message, 'commit-trailer')
  scan(prBody, 'pr-body')
  if (/^(?:claude|codex|cursor)\//i.test(branch)) add(branch.split('/')[0].replace(/^./, (x) => x.toUpperCase()), 'branch-name')
  return [...claims].map(([worker, hows]) => ({ worker, basis: [...hows], verified: false }))
}

/**
 * 같은 이름 검사는 시작이 가장 늦은 것 1개만 본다 — 봇의 scripts/ci/collapse-check-runs.jq와 같은 기준(started_at; 없을 때만 completed_at).
 * atTime(병합 시각)을 주면 그 뒤에 시작한 실행은 빼고, 병합 때 아직 끝나지 않았던 실행은 진행 중으로 본다(병합 뒤 재실행이 당시 상태를 바꾸지 않게).
 */
export function latestByName(checkRuns, atTime = null) {
  const cut = atTime ? Date.parse(atTime) : NaN
  const by = new Map()
  for (const r of checkRuns) {
    const t = Date.parse(r.started_at ?? r.completed_at ?? 0) || 0
    if (!Number.isNaN(cut) && t > cut) continue
    const doneAfterMerge = !Number.isNaN(cut) && r.status === 'completed' && Date.parse(r.completed_at ?? 0) > cut
    const prev = by.get(r.name)
    if (!prev || t >= prev.t) by.set(r.name, { t, conclusion: doneAfterMerge ? 'in_progress' : r.status === 'completed' ? r.conclusion : r.status, id: r.id })
  }
  return by
}

/**
 * 병합된 PR 한 건의 출처 기록(순수 함수).
 * pr: GitHub PR 객체, commits: [{sha, message, authorLogin, committerLogin}], mergeCommit: {committerLogin, authorLogin, message},
 * checkRuns: PR 최종 head의 검사 목록, finalHead: 병합 시점 head SHA
 */
export function provenance({ pr, commits, mergeCommit, checkRuns }) {
  const merger = pr.merged_by?.login ?? null
  const path = !merger ? UNKNOWN : BOT_MERGERS.includes(merger) ? 'bot-automerge' : 'account-credential'
  const latest = latestByName(checkRuns, pr.merged_at)
  const required = REQUIRED_CHECKS.map((name) => ({ name, latest: latest.get(name)?.conclusion ?? 'missing' }))
  const notGreen = required.filter((r) => r.latest !== 'success')
  const claims = aiClaims({ commits, prBody: pr.body, branch: pr.head?.ref })
  const authors = [...new Set(commits.map((c) => c.authorLogin).filter(Boolean))]
  return {
    pr: pr.number, title: String(pr.title ?? '').slice(0, 80), merged_at: pr.merged_at,
    // 서로 다른 필드(합치지 않음)
    commit_authors: authors.length ? authors : [UNKNOWN],
    pr_author: pr.user?.login ?? UNKNOWN,
    merged_by: merger ?? UNKNOWN,
    merge_commit_committer: mergeCommit?.committerLogin ?? UNKNOWN, // web-flow = GitHub가 합침(UI·API 모두)
    merge_path: path,
    // 병합 주체가 사람인지 AI 세션인지: bot 경로만 확정(GitHub 앱 계정), 계정 열쇠 경로는 구분 불가
    merger_kind: path === 'bot-automerge' ? 'bot(GitHub Actions)' : path === 'account-credential' ? '계정 열쇠 사용(사람·AI 세션 구분 불가 — 미확인)' : UNKNOWN,
    ai_worker_claims: claims, // 자기신고 — verified:false
    ai_worker: claims.length ? claims.map((c) => c.worker).join('+') + ' (자기신고)' : '식별 불가',
    ai_corroboration: authors.filter((a) => /^(claude|codex|cursor)(\[bot\])?$/i.test(a)).map((a) => `commit-author-login=${a}`), // 계정 기록과 일치하는 것만
    required_checks_latest: required,
    merged_with_non_green_required: notGreen.length ? notGreen.map((r) => `${r.name}=${r.latest}`) : [],
  }
}

const gh = (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
// 모든 페이지를 합친다(gh --paginate). 실패하면 던져서 그 PR은 error(미확인)로 남는다 — 일부 페이지만으로 판정하지 않는다.
const ghAll = (path, itemExpr) => execFileSync('gh', ['api', '--paginate', path, '--jq', itemExpr], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean).map((l) => JSON.parse(l))
export function collect(repo, number) {
  const pr = gh(`repos/${repo}/pulls/${number}`)
  if (!pr.merged) return null
  const commits = ghAll(`repos/${repo}/pulls/${number}/commits?per_page=100`, '.[]').map((c) => ({ sha: c.sha, message: c.commit.message, authorLogin: c.author?.login, committerLogin: c.committer?.login }))
  const mc = gh(`repos/${repo}/commits/${pr.merge_commit_sha}`)
  const checkRuns = ghAll(`repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`, '.check_runs[]')
  return provenance({ pr, commits, mergeCommit: { committerLogin: mc.committer?.login, authorLogin: mc.author?.login, message: mc.commit.message }, checkRuns })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = process.env.REPO || 'KHOAILANG0926/jobi-app'
  const limit = Number(process.env.LIMIT || 40)
  const only = String(process.env.PRS || '').split(/[\s,]+/).filter(Boolean).map(Number)
  // GitHub 목록은 병합 시각으로 정렬할 수 없다(updated는 댓글·수정에도 바뀜) → 닫힌 PR 전체를 읽고 merged_at 내림차순으로 limit개를 고른다
  const recentMerged = () => ghAll(`repos/${repo}/pulls?state=closed&base=master&per_page=100`, '.[] | select(.merged_at != null) | {number, merged_at}')
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at))
    .slice(0, limit)
    .map((p) => p.number)
  const nums = only.length ? only : recentMerged()
  const rows = []
  for (const n of nums) { if (rows.length >= (only.length || limit)) break; try { const r = collect(repo, n); if (r) rows.push(r) } catch (e) { rows.push({ pr: n, error: String(e.message).slice(0, 120) }) } }
  const ok = rows.filter((r) => !r.error)
  const count = (f) => ok.filter(f).length
  console.log(`## 병합 출처 기록 — ${ok.length}건\n`)
  console.log(`병합 경로: bot ${count((r) => r.merge_path === 'bot-automerge')} · 계정 열쇠(주체 구분 불가) ${count((r) => r.merge_path === 'account-credential')} · 미확인 ${count((r) => r.merge_path === UNKNOWN)}`)
  console.log(`AI 작업자: 자기신고 ${count((r) => r.ai_worker !== '식별 불가')} · 식별 불가 ${count((r) => r.ai_worker === '식별 불가')} · 계정 기록으로 뒷받침 ${count((r) => r.ai_corroboration.length)}`)
  const bad = ok.filter((r) => r.merged_with_non_green_required.length)
  console.log(`필수 검사가 초록이 아닌데 병합된 건: ${bad.length}${bad.length ? '\n' + bad.map((r) => `- #${r.pr} ${r.title} — ${r.merged_with_non_green_required.join(', ')} (병합 ${r.merged_by}, ${r.merge_path})`).join('\n') : ''}`)
  console.log('\n```json\n' + JSON.stringify(rows, null, 1) + '\n```')
}

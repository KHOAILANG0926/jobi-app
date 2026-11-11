// AI 팀 검사관 대기(Lee 2026-11-08 "팀을 만들자"): Claude가 만든 PR은 GPT Codex 검사를 거친 뒤 봇이 병합한다.
// 판정(현재 head 커밋 기준):
//  - Codex 검사가 이 커밋에 아직 없음 → 커밋 후 WAIT_MIN분까지 기다림(Codex가 한도 초과로 답하면 바로). 넘으면 Claude 검토관(2026-11-11) → 그것도 없으면 일반 파일만 진행.
//    단(Lee 2026-11-09): 이 PR의 예전 커밋 Codex 지적에 Claude 답이 없으면 진행 안 함(답 없이 새 커밋만 올려 대기 시간으로 넘어가는 것 차단),
//    운영·보안·DB 파일(check-repository-policy.mjs needsSecondReview)이 바뀐 PR은 두 번째 눈(Codex 또는 Claude 검토관) 없이 진행 안 함.
//    Codex는 승인자가 아니라 의견이다(Lee 2026-11-11): Codex가 없어도 Claude 검토관으로 끝까지 간다. Lee 확인으로 넘기지 않는다.
//  - Codex 검사가 끝났고 지적이 없음 → 진행.
//  - 지적이 있음 → 그 검사 뒤에 Claude 답(REPLY_MARKER 댓글)이 있어야 진행. 답이 없으면 기다림(시간 초과 없음).
// 지적 판단(Codex #558 검사 지적 반영): 줄 댓글, "수정 요청"(CHANGES_REQUESTED) 리뷰, Codex 요약 댓글의 has_unresolved_findings 중 하나라도 있으면 지적 있음.
// 답 표시는 Claude만 단다(Codex #558 지적: 공개 저장소라 누구나 댓글 가능) — REPLY_AUTHORS 계정의 댓글만 인정.
import { needsSecondReview } from './check-repository-policy.mjs'

// 12분(Lee 2026-11-11 "30분 너무 오래"): 최근 PR 9개 Codex 응답 27번 중 25번이 11분 안(절반은 2분 안) — 2026-11-11 실측.
export const WAIT_MIN = 12
// Claude 검토관(Codex 대신): Codex가 한도 초과로 답하거나 WAIT_MIN 안에 안 오면 GitHub에서 새 Claude 세션이 이 커밋을 검토한다
// (claude-auto.yml fallback-review, 구독 열쇠 — 추가 요금 없음). 요청 뒤 FALLBACK_WAIT_MIN 안에 결과가 없으면 일반 파일은 진행, 운영·보안·DB 파일은 검토관을 다시 부른다(최대 FALLBACK_MAX_TRIES번).
export const FALLBACK_WAIT_MIN = 20
export const FALLBACK_MARKER = '<!-- claude-fallback-review -->'
export const FALLBACK_REQUEST = '<!-- claude-fallback-request -->'
// Codex가 "You have reached your Codex usage limits for code reviews"로 답하면 기다리지 않는다(2026-11-11 #674: 10초 안에 이 답이 옴).
export const isCodexLimit = (c) => isCodex(c.user) && /usage limits for code reviews/i.test(String(c.body ?? ''))
/** 이 커밋의 Claude 검토관 결과: 첫 줄 표시, 둘째 줄 "sha: <커밋>", 셋째 줄 "findings: <수>". claude[bot] 계정만 인정(누구나 댓글 가능한 공개 저장소). */
export function fallbackReview(comments, sha) {
  return fallbackReviews(comments).filter((r) => r.sha === sha).at(-1) ?? null
}
/** 이 PR의 모든 Claude 검토관 결과(오래된 것부터, 커밋 상관없이). */
export function fallbackReviews(comments) {
  return comments.map((c) => {
    if (String(c.user?.login ?? '') !== 'claude[bot]') return null
    const [first, shaLine, findLine] = String(c.body ?? '').split('\n').map((l) => l.trim())
    const sm = /^sha: (\S+)$/.exec(shaLine ?? '')
    if (first !== FALLBACK_MARKER || !sm) return null
    const n = /^findings: (\d+)$/.exec(findLine ?? '')
    return n ? { sha: sm[1], findings: Number(n[1]), at: c.created_at } : null
  }).filter(Boolean)
}
/** 이 커밋으로 Claude 검토관을 부른 시각들(봇이 단 요청 표시 댓글, 오래된 것부터). */
export const fallbackRequests = (comments, sha) => comments.filter((c) => String(c.user?.login ?? '') === 'github-actions[bot]'
  && String(c.body ?? '').startsWith(`${FALLBACK_REQUEST} ${sha}`)).map((c) => c.created_at).sort()
export const FALLBACK_MAX_TRIES = 3
export const REPLY_MARKER = '<!-- claude-codex-reply -->'
export const REPLY_AUTHORS = new Set(['claude[bot]', 'KHOAILANG0926'])
// 진짜 Codex 검사관 봇 계정만(Codex #566 지적: 이름에 codex가 든 아무 계정이나 인정하면 가짜 요약으로 통과 가능).
export const CODEX_LOGIN = 'chatgpt-codex-connector[bot]'
export const isCodex = (u) => String(u?.login ?? '') === CODEX_LOGIN && (u?.type === undefined || u.type === 'Bot')
// 답 표시는 댓글 첫 줄이어야 인정한다(다른 댓글이 답을 인용(>)해 표시가 중간에 들어간 경우 제외).
export const isClaudeReply = (c) => REPLY_AUTHORS.has(String(c.user?.login ?? '')) && String(c.body ?? '').split('\n')[0].trim() === REPLY_MARKER
const repliedAfter = (comments, time) => comments.some((c) => isClaudeReply(c) && c.created_at >= time)

/** Codex 요약 댓글(<!-- codex-review-state:v1 {...} -->)의 code_review 상태 + 그 댓글이 마지막으로 바뀐 시각(at). 없으면 null. */
export function codexSummary(comments) {
  for (const c of [...comments].reverse()) {
    if (!isCodex(c.user)) continue
    const m = String(c.body ?? '').match(/<!-- codex-review-state:v1 (\{.*?\}) -->/)
    if (!m) continue
    try { const r = JSON.parse(m[1]).code_review; return r ? { ...r, at: c.updated_at ?? c.created_at ?? '' } : null } catch { return null }
  }
  return null
}

export function codexGate({ reviews, reviewComments, comments, sha, headDate, files = [], now = new Date() }) {
  const mine = reviews.filter((r) => isCodex(r.user) && r.commit_id === sha)
  const summary = codexSummary(comments)
  const summaryHere = summary && summary.commit_sha === sha && summary.status === 'completed' ? summary : null
  // Codex #677 P1: Claude 검토관 지적은 어느 커밋이든 답이 있어야 한다 — 새 커밋을 올리거나 Codex가 나중에 통과시켜도 답 의무가 사라지지 않게
  // (Codex 예전 지적에 답을 요구하는 것과 같은 규칙). 모든 통과 경로보다 먼저 본다.
  const lastFallbackFinding = fallbackReviews(comments).filter((r) => r.findings > 0).map((r) => r.at).sort().at(-1)
  if (lastFallbackFinding && !repliedAfter(comments, lastFallbackFinding)) return { ok: false, reason: 'Claude 검토관 지적에 Claude 답 대기' }
  if (!mine.length && !summaryHere) {
    const ageMin = (new Date(now) - new Date(headDate)) / 60000
    const limited = comments.some((c) => isCodexLimit(c) && c.created_at >= headDate)
    if (ageMin < WAIT_MIN && !limited) return { ok: false, reason: `Codex 검사 대기(${Math.floor(ageMin)}/${WAIT_MIN}분)` }
    const why = limited ? 'Codex 한도 초과' : `Codex 검사 없음(${Math.floor(ageMin)}분 경과)`
    // 이 PR에서 Codex가 마지막으로 지적한 시각(어느 커밋이든). 그 뒤에 Claude 답이 있어야 대기 통과를 쓴다.
    const lastFinding = [
      ...reviewComments.filter((c) => isCodex(c.user)).map((c) => c.created_at),
      ...reviews.filter((r) => isCodex(r.user) && r.state === 'CHANGES_REQUESTED').map((r) => r.submitted_at),
      summary?.has_unresolved_findings === true ? summary.at : '',
    ].filter(Boolean).sort().at(-1)
    if (lastFinding && !repliedAfter(comments, lastFinding)) return { ok: false, reason: `${why} — 예전 Codex 지적에 Claude 답 대기` }
    // Claude 검토관(두 번째 눈, Lee 2026-11-11 "Codex는 의견, 최종 판단은 Claude"): Codex가 없으면 검토관 결과로 판단한다.
    const fb = fallbackReview(comments, sha)
    if (fb) {
      if (!fb.findings) return { ok: true, reason: `${why} — Claude 검토관 통과(지적 없음)` }
      return repliedAfter(comments, fb.at) ? { ok: true, reason: `${why} — Claude 검토관 지적 ${fb.findings}개, 답 있음` } : { ok: false, reason: `${why} — Claude 검토관 지적 ${fb.findings}개, 답 대기` }
    }
    const asked = fallbackRequests(comments, sha)
    if (!asked.length) return { ok: false, needFallback: true, reason: `${why} — Claude 검토관 요청` }
    const askedMin = (new Date(now) - new Date(asked.at(-1))) / 60000
    if (askedMin < FALLBACK_WAIT_MIN) return { ok: false, reason: `${why} — Claude 검토관 대기(${Math.floor(askedMin)}/${FALLBACK_WAIT_MIN}분)` }
    // 검토관이 결과를 못 냄: 일반 파일은 기존 검사만으로 진행. 운영·보안·DB 파일은 두 번째 눈 없이 넣지 않고 검토관을 다시 부른다
    // (Lee에게 넘기지 않음 — Lee가 판단할 단계가 아님). FALLBACK_MAX_TRIES번 다 실패하면 장치 고장으로 보고 이슈로 알린다.
    const risky = files.filter(needsSecondReview)
    if (!risky.length) return { ok: true, reason: `${why}, Claude 검토관도 결과 없음 — 일반 파일이라 기존 검사만으로 진행` }
    const list = `${risky.slice(0, 3).join(', ')}${risky.length > 3 ? ' 외' : ''}`
    if (asked.length < FALLBACK_MAX_TRIES) return { ok: false, needFallback: true, reason: `${why} — 운영·보안·DB 파일(${list})이라 Claude 검토관 다시 요청(${asked.length + 1}/${FALLBACK_MAX_TRIES})` }
    return { ok: false, reviewerBroken: true, reason: `${why} — Claude 검토관 ${FALLBACK_MAX_TRIES}번 결과 없음(장치 고장): 운영·보안·DB 파일(${list}) 병합 보류` }
  }
  // 줄 지적은 처음 단 커밋(original_commit_id) 기준 — GitHub은 새 커밋이 와도 줄이 그대로면 commit_id를 최신으로 옮겨서,
  // 이미 고친 예전 지적이 새 커밋 지적처럼 보여 병합이 멈췄다(2026-11-09 #581).
  const lines = reviewComments.filter((c) => isCodex(c.user) && (c.original_commit_id ?? c.commit_id) === sha).length
  const blocking = mine.some((r) => r.state === 'CHANGES_REQUESTED')
  const unresolved = summaryHere?.has_unresolved_findings === true
  if (!lines && !blocking && !unresolved) return { ok: true, reason: 'Codex 검사 통과(지적 없음)' }
  // 답은 이 커밋에 대한 Codex 검사(리뷰 또는 요약 갱신) 뒤에 달린 것만 인정한다(Codex #566 지적: 예전 커밋 답 재사용 방지).
  const last = [...mine.map((r) => r.submitted_at), summaryHere?.at].filter(Boolean).sort().at(-1) ?? ''
  if (!last) return { ok: false, reason: 'Codex 검사 시각을 알 수 없음 — 대기' }
  const replied = repliedAfter(comments, last)
  const what = `Codex 지적(줄 ${lines}${blocking ? ', 수정 요청' : ''}${unresolved ? ', 미해결 표시' : ''})`
  return replied ? { ok: true, reason: `${what} — Claude 답 있음` } : { ok: false, reason: `${what} — Claude 답 대기` }
}

// CLI (bot-pr-automerge.yml, 신뢰된 master 소스): reviews.json review-comments.json comments.json sha headDate files.json
// 종료 코드: 0 진행 / 1 대기 / 2 검토관 장치 고장(이슈로 알림) / 3 Claude 검토관을 불러야 함
if (process.argv[1]?.endsWith('codex-review-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  const [reviews, reviewComments, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const files = process.argv[7] ? JSON.parse(readFileSync(process.argv[7], 'utf8')).map((f) => f.filename) : []
  const r = codexGate({ reviews, reviewComments, comments, sha: process.argv[5], headDate: process.argv[6], files })
  console.log(r.reason)
  process.exit(r.ok ? 0 : r.reviewerBroken ? 2 : r.needFallback ? 3 : 1)
}

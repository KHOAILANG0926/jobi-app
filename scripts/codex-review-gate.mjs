// AI 팀 검사관 대기(Lee 2026-11-08 "팀을 만들자"): Claude가 만든 PR은 GPT Codex 검사를 거친 뒤 봇이 병합한다.
// 판정(현재 head 커밋 기준):
//  - Codex 검사가 이 커밋에 아직 없음 → 커밋 후 WAIT_MIN분까지 기다림. 넘으면 진행(Codex가 안 오면 일이 멈추지 않게, 기록만).
//  - Codex 검사가 끝났고 지적이 없음 → 진행.
//  - 지적이 있음 → 그 검사 뒤에 Claude 답(REPLY_MARKER 댓글)이 있어야 진행. 답이 없으면 기다림(시간 초과 없음).
// 지적 판단(Codex #558 검사 지적 반영): 줄 댓글, "수정 요청"(CHANGES_REQUESTED) 리뷰, Codex 요약 댓글의 has_unresolved_findings 중 하나라도 있으면 지적 있음.
// 답 표시는 Claude만 단다(Codex #558 지적: 공개 저장소라 누구나 댓글 가능) — REPLY_AUTHORS 계정의 댓글만 인정.
export const WAIT_MIN = 30
export const REPLY_MARKER = '<!-- claude-codex-reply -->'
export const REPLY_AUTHORS = new Set(['claude[bot]', 'KHOAILANG0926'])
// 진짜 Codex 검사관 봇 계정만(Codex #566 지적: 이름에 codex가 든 아무 계정이나 인정하면 가짜 요약으로 통과 가능).
export const CODEX_LOGIN = 'chatgpt-codex-connector[bot]'
export const isCodex = (u) => String(u?.login ?? '') === CODEX_LOGIN && (u?.type === undefined || u.type === 'Bot')

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

export function codexGate({ reviews, reviewComments, comments, sha, headDate, now = new Date() }) {
  const mine = reviews.filter((r) => isCodex(r.user) && r.commit_id === sha)
  const summary = codexSummary(comments)
  const summaryHere = summary && summary.commit_sha === sha && summary.status === 'completed' ? summary : null
  if (!mine.length && !summaryHere) {
    const ageMin = (new Date(now) - new Date(headDate)) / 60000
    return ageMin >= WAIT_MIN
      ? { ok: true, reason: `Codex 검사 없음(${Math.floor(ageMin)}분 경과) — 기존 검사만으로 진행` }
      : { ok: false, reason: `Codex 검사 대기(${Math.floor(ageMin)}/${WAIT_MIN}분)` }
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
  const replied = comments.some((c) => REPLY_AUTHORS.has(String(c.user?.login ?? '')) && String(c.body ?? '').includes(REPLY_MARKER) && c.created_at >= last)
  const what = `Codex 지적(줄 ${lines}${blocking ? ', 수정 요청' : ''}${unresolved ? ', 미해결 표시' : ''})`
  return replied ? { ok: true, reason: `${what} — Claude 답 있음` } : { ok: false, reason: `${what} — Claude 답 대기` }
}

// CLI (bot-pr-automerge.yml, 신뢰된 master 소스): reviews.json review-comments.json comments.json sha headDate
if (process.argv[1]?.endsWith('codex-review-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  const [reviews, reviewComments, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const r = codexGate({ reviews, reviewComments, comments, sha: process.argv[5], headDate: process.argv[6] })
  console.log(r.reason)
  process.exit(r.ok ? 0 : 1)
}

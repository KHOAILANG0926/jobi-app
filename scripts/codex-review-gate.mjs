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
export const isCodex = (u) => /codex/i.test(String(u?.login ?? ''))

/** Codex 요약 댓글(<!-- codex-review-state:v1 {...} -->)의 code_review 상태. 없거나 읽을 수 없으면 null. */
export function codexSummary(comments) {
  for (const c of [...comments].reverse()) {
    if (!isCodex(c.user)) continue
    const m = String(c.body ?? '').match(/<!-- codex-review-state:v1 (\{.*?\}) -->/)
    if (!m) continue
    try { return JSON.parse(m[1]).code_review ?? null } catch { return null }
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
  const lines = reviewComments.filter((c) => isCodex(c.user) && c.commit_id === sha).length
  const blocking = mine.some((r) => r.state === 'CHANGES_REQUESTED')
  const unresolved = summaryHere?.has_unresolved_findings === true
  if (!lines && !blocking && !unresolved) return { ok: true, reason: 'Codex 검사 통과(지적 없음)' }
  const last = mine.map((r) => r.submitted_at).filter(Boolean).sort().at(-1) ?? ''
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

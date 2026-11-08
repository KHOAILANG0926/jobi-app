// AI 팀 검사관 대기(Lee 2026-11-08 "팀을 만들자"): Claude가 만든 PR은 GPT Codex 검사를 거친 뒤 봇이 병합한다.
// 판정(현재 head 커밋 기준):
//  - Codex 검사가 이 커밋에 아직 없음 → 커밋 후 WAIT_MIN분까지 기다림. 넘으면 진행(Codex가 안 오면 일이 멈추지 않게, 기록만).
//  - Codex 검사가 있고 지적(줄 댓글)이 0개 → 진행.
//  - 지적이 있음 → 그 검사 뒤에 Claude 답(REPLY_MARKER 댓글: 고쳤으면 새 커밋이 와서 다시 검사, 틀린 지적이면 근거)이 있어야 진행.
//    답이 없으면 기다림(시간 초과 없음 — 지적을 건너뛰고 병합하지 않는다. 아침 보고에 남음).
export const WAIT_MIN = 30
export const REPLY_MARKER = '<!-- claude-codex-reply -->'
export const isCodex = (u) => /codex/i.test(String(u?.login ?? ''))

export function codexGate({ reviews, reviewComments, comments, sha, headDate, now = new Date() }) {
  const mine = reviews.filter((r) => isCodex(r.user) && r.commit_id === sha)
  if (!mine.length) {
    const ageMin = (new Date(now) - new Date(headDate)) / 60000
    return ageMin >= WAIT_MIN
      ? { ok: true, reason: `Codex 검사 없음(${Math.floor(ageMin)}분 경과) — 기존 검사만으로 진행` }
      : { ok: false, reason: `Codex 검사 대기(${Math.floor(ageMin)}/${WAIT_MIN}분)` }
  }
  const last = mine.map((r) => r.submitted_at).sort().at(-1)
  const findings = reviewComments.filter((c) => isCodex(c.user) && c.commit_id === sha).length
  if (!findings) return { ok: true, reason: 'Codex 검사 통과(지적 없음)' }
  const replied = comments.some((c) => String(c.body ?? '').includes(REPLY_MARKER) && c.created_at >= last)
  return replied
    ? { ok: true, reason: `Codex 지적 ${findings}개 — Claude 답 있음` }
    : { ok: false, reason: `Codex 지적 ${findings}개 — Claude 답 대기` }
}

// CLI (bot-pr-automerge.yml, 신뢰된 master 소스): reviews.json review-comments.json comments.json sha headDate
if (process.argv[1]?.endsWith('codex-review-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  const [reviews, reviewComments, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const r = codexGate({ reviews, reviewComments, comments, sha: process.argv[5], headDate: process.argv[6] })
  console.log(r.reason)
  process.exit(r.ok ? 0 : 1)
}

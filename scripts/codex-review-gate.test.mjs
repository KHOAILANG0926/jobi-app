import assert from 'node:assert/strict'
import { codexGate, REPLY_AUTHORS, REPLY_MARKER, WAIT_MIN, FALLBACK_WAIT_MIN, FALLBACK_MARKER, FALLBACK_REQUEST, FALLBACK_MAX_TRIES } from './codex-review-gate.mjs'

const sha = 'abc123', headDate = '2026-11-08T16:00:00Z'
const codex = { login: 'chatgpt-codex-connector[bot]', type: 'Bot' }, claude = { login: 'claude[bot]' }, stranger = { login: 'random-user' }
const at = (min) => new Date(Date.parse(headDate) + min * 60000)
const base = { reviews: [], reviewComments: [], comments: [], sha, headDate }
const bot = { login: 'github-actions[bot]' }
// Claude 검토관 요청 표시(봇) — WAIT_MIN 시각에 단 것으로 둔다
const asked = { user: bot, body: `${FALLBACK_REQUEST} ${sha}`, created_at: at(WAIT_MIN).toISOString() }
const lateNow = at(WAIT_MIN + FALLBACK_WAIT_MIN + 1)

assert.equal(codexGate({ ...base, now: at(5) }).ok, false, 'no Codex review yet → wait')
assert.equal(codexGate({ ...base, now: at(WAIT_MIN + 1) }).needFallback, true, 'Codex silent past wait → call Claude fallback reviewer')
// Lee 2026-11-11: Codex 한도 초과 답이 오면 기다리지 않고 바로 검토관
const limit = { user: codex, body: 'You have reached your Codex usage limits for code reviews.', created_at: at(1).toISOString() }
assert.equal(codexGate({ ...base, comments: [limit], now: at(2) }).needFallback, true, 'Codex usage limit → fallback immediately')
assert.equal(codexGate({ ...base, comments: [{ ...limit, user: stranger }], now: at(2) }).ok, false, 'limit text from non-Codex account does not skip the wait')
assert.equal(codexGate({ ...base, comments: [{ ...limit, user: stranger }], now: at(2) }).needFallback, undefined, 'limit text from non-Codex account → still waiting')
assert.equal(codexGate({ ...base, comments: [asked], now: at(WAIT_MIN + 5) }).ok, false, 'fallback requested, result not yet in → wait')
const fbr = (n, who = claude, s2 = sha) => ({ user: who, body: `${FALLBACK_MARKER}\nsha: ${s2}\nfindings: ${n}\n내용`, created_at: at(WAIT_MIN + 6).toISOString() })
assert.equal(codexGate({ ...base, files: ['scripts/codex-review-gate.mjs'], comments: [asked, fbr(0)], now: at(WAIT_MIN + 7) }).ok, true, 'fallback review without findings → proceed (even risky files)')
assert.equal(codexGate({ ...base, comments: [asked, fbr(2)], now: lateNow }).ok, false, 'fallback findings without reply → wait')
assert.equal(codexGate({ ...base, comments: [asked, fbr(2), { user: claude, body: REPLY_MARKER, created_at: at(WAIT_MIN + 8).toISOString() }], now: lateNow }).ok, true, 'fallback findings answered → proceed')
assert.equal(codexGate({ ...base, comments: [asked, fbr(0, stranger)], now: at(WAIT_MIN + 7) }).ok, false, 'fallback result from other account ignored')
assert.equal(codexGate({ ...base, comments: [asked, fbr(0, claude, 'old')], now: at(WAIT_MIN + 7) }).ok, false, 'fallback result for another commit ignored')
assert.equal(codexGate({ ...base, comments: [{ ...asked, user: stranger }], now: at(WAIT_MIN + 5) }).needFallback, true, 'request marker from non-bot account ignored')
assert.equal(codexGate({ ...base, comments: [asked], now: lateNow }).ok, true, 'fallback timed out, ordinary files → proceed on existing checks')
assert.equal(codexGate({ ...base, reviews: [{ user: codex, commit_id: 'old', submitted_at: '2026-11-08T15:00:00Z' }], now: at(5) }).ok, false, 'review on older commit does not count')
const rv = [{ user: codex, commit_id: sha, submitted_at: '2026-11-08T16:10:00Z' }]
assert.equal(codexGate({ ...base, reviews: rv, now: at(11) }).ok, true, 'Codex reviewed, no findings → proceed')
const rc = [{ user: codex, commit_id: sha }]
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, now: at(300) }).ok, false, 'findings without Claude reply → wait, never times out')
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, comments: [{ user: claude, body: `${REPLY_MARKER}\n근거…`, created_at: '2026-11-08T16:05:00Z' }], now: at(20) }).ok, false, 'reply before the review does not count')
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, comments: [{ user: claude, body: `${REPLY_MARKER}\n근거…`, created_at: '2026-11-08T16:20:00Z' }], now: at(21) }).ok, true, 'Claude replied after findings → proceed')
// 답 표시는 첫 줄 단독이어야 한다: 같은 줄 설명·인용(>)·첫 줄 아님은 거부
for (const body of [`${REPLY_MARKER} 근거…`, `> ${REPLY_MARKER}\n근거`, `안녕\n${REPLY_MARKER}`]) {
  assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, comments: [{ user: claude, body, created_at: '2026-11-08T16:20:00Z' }], now: at(21) }).ok, false, `marker not alone on first line rejected: ${body.slice(0, 12)}`)
}
assert.equal(codexGate({ ...base, reviews: [{ user: { login: 'someone' }, commit_id: sha, submitted_at: '2026-11-08T16:10:00Z' }], now: at(11) }).ok, false, 'non-Codex review is not the Codex check')
// Codex #558 지적 1: 남이 단 답 표시는 인정하지 않는다(공개 저장소)
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, comments: [{ user: stranger, body: `${REPLY_MARKER}`, created_at: '2026-11-08T16:20:00Z' }], now: at(21) }).ok, false, 'reply marker from non-Claude account ignored')
// Codex #558 지적 2: 줄 댓글 없이 수정 요청 / 요약 미해결 표시도 지적이다
assert.equal(codexGate({ ...base, reviews: [{ ...rv[0], state: 'CHANGES_REQUESTED' }], now: at(11) }).ok, false, 'CHANGES_REQUESTED without inline comments still blocks')
const summary = (commit, unresolved, status = 'completed') => ({ user: codex, created_at: '2026-11-08T16:09:00Z', updated_at: '2026-11-08T16:15:00Z',
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {"code_review":{"commit_sha":"${commit}","has_any_findings":${unresolved},"has_unresolved_findings":${unresolved},"status":"${status}"},"security_review":{"commit_sha":null}} -->` })
assert.equal(codexGate({ ...base, comments: [summary(sha, true)], now: at(11) }).ok, false, 'summary says unresolved findings → wait for Claude')
assert.equal(codexGate({ ...base, comments: [summary(sha, false)], now: at(11) }).ok, true, 'summary completed without findings → proceed (no review object needed)')
assert.equal(codexGate({ ...base, comments: [summary(sha, false, 'running')], now: at(5) }).ok, false, 'summary still running → wait')
assert.equal(codexGate({ ...base, comments: [summary('other', false)], now: at(5) }).ok, false, 'summary for older commit → wait')
assert.equal(codexGate({ ...base, comments: [summary(sha, true), { user: { login: 'KHOAILANG0926' }, body: `${REPLY_MARKER}\n근거`, created_at: '2026-11-08T16:20:00Z' }], now: at(21) }).ok, true, 'Claude session reply (Lee account) accepted')
// Codex #566 지적: 요약만 있는 지적에 예전 답(요약 갱신 전)을 재사용하지 않는다
assert.equal(codexGate({ ...base, comments: [{ user: claude, body: `${REPLY_MARKER}\n예전 커밋 답`, created_at: '2026-11-08T16:10:00Z' }, summary(sha, true)], now: at(30) }).ok, false, 'old reply before summary update does not count')
// Codex #566 지적: 이름에 codex가 든 가짜 계정의 '통과' 요약은 무시(진짜 미해결 요약을 덮지 못함)
const fake = { ...summary(sha, false), user: { login: 'random-codex-user', type: 'User' }, updated_at: '2026-11-08T16:20:00Z' }
assert.equal(codexGate({ ...base, comments: [summary(sha, true), fake], now: at(30) }).ok, false, 'forged finding-free summary from look-alike account ignored')
assert.equal(codexGate({ ...base, reviews: [{ ...rv[0], user: { login: 'random-codex-user', type: 'User' } }], now: at(11) }).ok, false, 'look-alike reviewer is not Codex')
// #581: 예전 커밋 줄 지적이 GitHub에서 commit_id만 최신으로 옮겨져도 새 지적으로 세지 않는다
assert.equal(codexGate({ ...base, comments: [summary(sha, false)], reviewComments: [{ user: codex, commit_id: sha, original_commit_id: 'old' }], now: at(11) }).ok, true, 'stale inline finding moved to new head is not a new finding')
assert.equal(codexGate({ ...base, comments: [summary(sha, false)], reviewComments: [{ user: codex, commit_id: sha, original_commit_id: sha }], now: at(11) }).ok, false, 'inline finding made on this head still blocks')
// Lee 2026-11-09: 예전 커밋 지적에 답 없이 새 커밋만 올리고 Codex가 안 오면 30분으로 넘어가지 않는다
const oldLine = [{ user: codex, commit_id: 'old', original_commit_id: 'old', created_at: '2026-11-08T15:30:00Z' }]
assert.equal(codexGate({ ...base, reviewComments: oldLine, comments: [asked], now: lateNow }).ok, false, 'earlier finding without reply blocks the timeout pass')
assert.equal(codexGate({ ...base, reviewComments: oldLine, comments: [{ user: claude, body: REPLY_MARKER, created_at: '2026-11-08T15:40:00Z' }, asked], now: lateNow }).ok, true, 'earlier finding answered → timeout pass allowed')
assert.equal(codexGate({ ...base, comments: [summary('old', true)], now: at(WAIT_MIN + 5) }).ok, false, 'older-commit summary with unresolved findings and no reply blocks')
assert.equal(codexGate({ ...base, reviews: [{ user: codex, commit_id: 'old', state: 'CHANGES_REQUESTED', submitted_at: '2026-11-08T15:30:00Z' }], now: at(WAIT_MIN + 5) }).ok, false, 'older CHANGES_REQUESTED without reply blocks')
// Lee 2026-11-11: Codex는 의견 — 운영·보안·DB 파일도 Lee 확인으로 넘기지 않고 Claude 검토관을 다시 부른다. 3번 다 결과 없으면 장치 고장.
for (const f of ['supabase/migrations/20261109_x.sql', '.github/workflows/ops-run-sql.yml', 'scripts/ops/jobs/fix-1.sql', 'src/lib/authStorage.ts', 'scripts/codex-review-gate.mjs']) {
  const r = codexGate({ ...base, files: [f], comments: [asked], now: lateNow })
  assert.equal(r.ok, false, `risky file ${f} without any review → not merged`); assert.equal(r.needFallback, true, `risky file ${f} → ask reviewer again`)
  assert.equal(r.needsLee, undefined, `risky file ${f} → never handed to Lee`)
}
const tries = Array.from({ length: FALLBACK_MAX_TRIES }, (_, i) => ({ ...asked, created_at: at(WAIT_MIN + i * (FALLBACK_WAIT_MIN + 1)).toISOString() }))
const broken = codexGate({ ...base, files: ['supabase/migrations/x.sql'], comments: tries, now: at(WAIT_MIN + FALLBACK_MAX_TRIES * (FALLBACK_WAIT_MIN + 1)) })
assert.equal(broken.ok, false, 'reviewer failed every try → risky PR held'); assert.equal(broken.reviewerBroken, true, 'reviewer failed every try → reported as broken')
assert.equal(codexGate({ ...base, files: ['supabase/migrations/x.sql'], comments: [...tries, fbr(0)], now: at(200) }).ok, true, 'reviewer finally passes after retries → proceed')
assert.equal(codexGate({ ...base, files: ['src/pages/PostJob.tsx', 'scripts/ops/jobs/fb-x.json'], comments: [asked], now: lateNow }).ok, true, 'ordinary files without Codex or fallback → proceed after wait')
assert.equal(codexGate({ ...base, files: ['supabase/migrations/x.sql'], comments: [summary(sha, false)], now: at(11) }).ok, true, 'risky file with finding-free Codex review → proceed')
// Codex #677 P1: 검토관 지적은 새 커밋·Codex 통과로 사라지지 않는다
const oldFb = { ...fbr(2, claude, 'old0000'), created_at: '2026-11-08T15:50:00Z' }
assert.equal(codexGate({ ...base, comments: [oldFb, asked], now: lateNow }).ok, false, 'fallback findings on an earlier commit without reply block the timeout pass')
assert.equal(codexGate({ ...base, comments: [oldFb, summary(sha, false)], now: at(11) }).ok, false, 'fallback findings without reply block even a clean Codex review')
assert.equal(codexGate({ ...base, comments: [oldFb, { user: claude, body: REPLY_MARKER, created_at: '2026-11-08T15:55:00Z' }, summary(sha, false)], now: at(11) }).ok, true, 'answered fallback findings + clean Codex → proceed')
console.log('codex-review-gate: all assertions passed')

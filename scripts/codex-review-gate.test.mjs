import assert from 'node:assert/strict'
import { codexGate, REPLY_AUTHORS, REPLY_MARKER, WAIT_MIN } from './codex-review-gate.mjs'

const sha = 'abc123', headDate = '2026-11-08T16:00:00Z'
const codex = { login: 'chatgpt-codex-connector[bot]', type: 'Bot' }, claude = { login: 'claude[bot]' }, stranger = { login: 'random-user' }
const at = (min) => new Date(Date.parse(headDate) + min * 60000)
const base = { reviews: [], reviewComments: [], comments: [], sha, headDate }

assert.equal(codexGate({ ...base, now: at(5) }).ok, false, 'no Codex review yet → wait')
assert.equal(codexGate({ ...base, now: at(WAIT_MIN + 1) }).ok, true, 'Codex silent past wait → proceed')
assert.equal(codexGate({ ...base, reviews: [{ user: codex, commit_id: 'old', submitted_at: '2026-11-08T15:00:00Z' }], now: at(5) }).ok, false, 'review on older commit does not count')
const rv = [{ user: codex, commit_id: sha, submitted_at: '2026-11-08T16:10:00Z' }]
assert.equal(codexGate({ ...base, reviews: rv, now: at(11) }).ok, true, 'Codex reviewed, no findings → proceed')
const rc = [{ user: codex, commit_id: sha }]
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, now: at(300) }).ok, false, 'findings without Claude reply → wait, never times out')
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, comments: [{ user: claude, body: `${REPLY_MARKER} 근거…`, created_at: '2026-11-08T16:05:00Z' }], now: at(20) }).ok, false, 'reply before the review does not count')
assert.equal(codexGate({ ...base, reviews: rv, reviewComments: rc, comments: [{ user: claude, body: `${REPLY_MARKER} 근거…`, created_at: '2026-11-08T16:20:00Z' }], now: at(21) }).ok, true, 'Claude replied after findings → proceed')
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
assert.equal(codexGate({ ...base, comments: [summary(sha, true), { user: { login: 'KHOAILANG0926' }, body: `${REPLY_MARKER} 근거`, created_at: '2026-11-08T16:20:00Z' }], now: at(21) }).ok, true, 'Claude session reply (Lee account) accepted')
// Codex #566 지적: 요약만 있는 지적에 예전 답(요약 갱신 전)을 재사용하지 않는다
assert.equal(codexGate({ ...base, comments: [{ user: claude, body: `${REPLY_MARKER} 예전 커밋 답`, created_at: '2026-11-08T16:10:00Z' }, summary(sha, true)], now: at(30) }).ok, false, 'old reply before summary update does not count')
// Codex #566 지적: 이름에 codex가 든 가짜 계정의 '통과' 요약은 무시(진짜 미해결 요약을 덮지 못함)
const fake = { ...summary(sha, false), user: { login: 'random-codex-user', type: 'User' }, updated_at: '2026-11-08T16:20:00Z' }
assert.equal(codexGate({ ...base, comments: [summary(sha, true), fake], now: at(30) }).ok, false, 'forged finding-free summary from look-alike account ignored')
assert.equal(codexGate({ ...base, reviews: [{ ...rv[0], user: { login: 'random-codex-user', type: 'User' } }], now: at(11) }).ok, false, 'look-alike reviewer is not Codex')
console.log('codex-review-gate: all assertions passed')

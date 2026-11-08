import assert from 'node:assert/strict'
import { codexGate, REPLY_MARKER, WAIT_MIN } from './codex-review-gate.mjs'

const sha = 'abc123', headDate = '2026-11-08T16:00:00Z'
const codex = { login: 'chatgpt-codex-connector[bot]' }, claude = { login: 'claude[bot]' }
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
console.log('codex-review-gate: all assertions passed')

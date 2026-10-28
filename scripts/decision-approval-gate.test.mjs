import assert from 'node:assert/strict'
import { decisionApproval, requestText } from './decision-approval-gate.mjs'
const sha = 'a'.repeat(40), old = 'b'.repeat(40)
const doc = [{ filename: 'docs/decisions/ko/0006-x.md' }]
assert.equal(decisionApproval({ files: [{ filename: 'src/a.ts' }], reviews: [], comments: [], sha }).approved, true, 'other PRs unaffected')
assert.equal(decisionApproval({ files: doc, reviews: [], comments: [], sha }).approved, false, 'decision change without approval is blocked')
assert.equal(decisionApproval({ files: [{ filename: '.github/CODEOWNERS' }], reviews: [], comments: [], sha }).approved, false, 'CODEOWNERS change is blocked')
assert.equal(decisionApproval({ files: doc, reviews: [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: sha }], comments: [], sha }).approved, true, 'head approval by Lee passes')
assert.equal(decisionApproval({ files: doc, reviews: [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: old }], comments: [], sha }).approved, false, 'approval of an older commit does not count')
assert.equal(decisionApproval({ files: doc, reviews: [{ user: { login: 'someone' }, state: 'APPROVED', commit_id: sha }], comments: [], sha }).approved, false, 'other account approval does not count')
assert.equal(decisionApproval({ files: doc, reviews: [], comments: [{ user: { login: 'KHOAILANG0926' }, body: `LEE-APPROVE ${sha}` }], sha }).approved, true, 'Lee comment for head SHA passes')
assert.equal(decisionApproval({ files: doc, reviews: [], comments: [{ user: { login: 'KHOAILANG0926' }, body: `LEE-APPROVE ${old}` }], sha }).approved, false, 'comment for an older SHA does not count')
assert.match(requestText(sha, ['docs/decisions/ko/0006-x.md']), /Lee 승인 필요/)
console.log('decision-approval-gate: decision/CODEOWNERS PRs need Lee approval at head; other PRs unaffected')

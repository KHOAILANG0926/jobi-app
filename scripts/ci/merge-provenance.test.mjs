// R3(#728): 병합 출처 기록 판정 시험 — #687 사례(필수 checks가 빨간데 Lee 계정으로 병합)와 봇 병합·표시 없는 PR.
import assert from 'node:assert/strict'
import { provenance, aiClaims, latestByName, UNKNOWN } from './merge-provenance.mjs'

const run = (name, conclusion, completed_at) => ({ id: Math.random(), name, status: 'completed', conclusion, completed_at })
const green = [run('guard', 'success', '2026-11-11T04:09:27Z'), run('app-screen', 'success', '2026-11-11T04:14:08Z')]

// #687 실제 모양: checks 두 번(04:09:28 성공, 04:09:48 실패) → 가장 최근이 실패. 병합 계정 = Lee, 병합 커밋 committer = web-flow, 커밋 작성자 = claude
const p687 = provenance({
  pr: { number: 687, title: '규칙', merged_at: '2026-11-11T04:38:09Z', merged_by: { login: 'KHOAILANG0926' }, user: { login: 'KHOAILANG0926' }, body: '', head: { ref: 'claude/x' } },
  commits: [{ sha: 'a', message: '규칙\n\nClaude-Session: https://claude.ai/code/session_01ABC', authorLogin: 'claude', committerLogin: 'claude' }],
  mergeCommit: { committerLogin: 'web-flow' },
  checkRuns: [run('checks', 'success', '2026-11-11T04:09:28Z'), run('checks', 'failure', '2026-11-11T04:09:48Z'), ...green],
})
assert.deepEqual(p687.merged_with_non_green_required, ['checks=failure'], '같은 이름 중 가장 최근(실패)이 기준')
assert.equal(p687.merge_path, 'account-credential')
assert.match(p687.merger_kind, /구분 불가/, '병합 계정이 Lee여도 사람인지 AI 세션인지 확정하지 않음')
assert.deepEqual([p687.commit_authors, p687.pr_author, p687.merged_by, p687.merge_commit_committer], [['claude'], 'KHOAILANG0926', 'KHOAILANG0926', 'web-flow'], '작성자·PR 작성자·병합 계정·병합 커밋은 서로 다른 필드')
assert.equal(p687.ai_worker, 'Claude (자기신고)')
assert.equal(p687.ai_worker_claims[0].verified, false, '꼬리표는 자기신고')
assert.deepEqual(p687.ai_corroboration, ['commit-author-login=claude'], '계정 기록과 일치하는 것만 뒷받침')

// 봇 병합 + 모두 초록
const pbot = provenance({
  pr: { number: 765, title: 'x', merged_at: 't', merged_by: { login: 'github-actions[bot]' }, user: { login: 'KHOAILANG0926' }, body: '🤖 Generated with [Claude Code](https://claude.com/claude-code)', head: { ref: 'fix/y' } },
  commits: [{ sha: 'b', message: 'fix', authorLogin: 'KHOAILANG0926' }], mergeCommit: { committerLogin: 'web-flow' },
  checkRuns: [run('checks', 'success', '2026-11-12T20:00:00Z'), ...green],
})
assert.equal(pbot.merge_path, 'bot-automerge'); assert.deepEqual(pbot.merged_with_non_green_required, [])
assert.deepEqual(pbot.ai_worker_claims.map((c) => c.basis), [['pr-body']], '본문 표시만 → 자기신고')
assert.deepEqual(pbot.ai_corroboration, [], '작성자가 Lee면 계정 기록으로 뒷받침되는 AI 증거 없음(Lee 계정 작성자를 AI로 추정하지 않음)')

// 표시 없는 PR = 식별 불가, 필수 검사 기록 없음 = missing(초록 아님)
const pnone = provenance({
  pr: { number: 1, title: 'old', merged_at: 't', merged_by: null, user: { login: 'someone' }, body: '', head: { ref: 'old' } },
  commits: [{ sha: 'c', message: 'old work' }], mergeCommit: {}, checkRuns: [],
})
assert.equal(pnone.ai_worker, '식별 불가'); assert.equal(pnone.merge_path, UNKNOWN); assert.equal(pnone.merged_by, UNKNOWN)
assert.deepEqual(pnone.merged_with_non_green_required, ['checks=missing', 'guard=missing', 'app-screen=missing'])
assert.deepEqual(pnone.commit_authors, [UNKNOWN])

// 진행 중인 검사는 초록이 아님, 표시 읽기
assert.equal(latestByName([{ id: 1, name: 'checks', status: 'in_progress', started_at: '2026-01-01T00:00:00Z' }]).get('checks').conclusion, 'in_progress')
assert.deepEqual(aiClaims({ commits: [{ message: 'Co-Authored-By: Claude Sonnet 5.5 <n@a>' }, { message: 'Co-Authored-By: GPT Codex <x>' }] }).map((c) => c.worker).sort(), ['Claude', 'Codex', 'GPT'], '한 줄에 두 이름이 있으면 둘 다 자기신고로 읽음')
console.log('merge-provenance.test.mjs: 통과')

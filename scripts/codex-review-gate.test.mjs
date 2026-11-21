// 독립 검토 표시 문자열 시험(Lee 2026-11-21): 판정 함수는 지웠고(병합 조건 아님), 수동 검토 경로가 쓰는 표시만 남는다.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as gate from './codex-review-gate.mjs'
assert.deepEqual(Object.keys(gate).sort(), ['FALLBACK_MARKER', 'REPLY_MARKER'], '표시 두 개만 남음(판정 함수 없음)')
assert.equal(gate.FALLBACK_MARKER, '<!-- claude-fallback-review -->')
assert.equal(gate.REPLY_MARKER, '<!-- claude-codex-reply -->')
// 같은 표시를 쓰는 곳과 글자가 같아야 한다(검토관 결과 댓글·봇 깨우기 조건)
const auto = readFileSync(new URL('../.github/workflows/claude-auto.yml', import.meta.url), 'utf8')
const bot = readFileSync(new URL('../.github/workflows/bot-pr-automerge.yml', import.meta.url), 'utf8')
assert.ok(auto.includes(gate.FALLBACK_MARKER), 'claude-auto 검토관이 같은 표시 사용')
assert.ok(bot.includes(gate.FALLBACK_MARKER) && bot.includes(gate.REPLY_MARKER), '봇 깨우기 조건이 같은 표시 사용')
assert.ok(!/node scripts\/codex-review-gate\.mjs/.test(bot.replace(/^\s*#.*$/gm, '')), '봇은 검토 판정을 부르지 않음')
console.log('codex-review-gate: 표시 문자열 시험 통과(판정 함수 없음)')

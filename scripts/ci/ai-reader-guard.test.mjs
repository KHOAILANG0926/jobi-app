// AI 판독 교정 분리 시험(비밀키 없음): ① 판정 함수 ② PR 검사 경로에 Secret 참조가 없다 ③ 교정 워크플로는 PR 이벤트로 돌지 않는다.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decide, readerInputsChanged } from './ai-reader-guard.mjs'

const SHA = 'a'.repeat(40)
const ok = (extra = {}) => ({ event: 'workflow_dispatch', head_sha: SHA, status: 'completed', conclusion: 'success', ...extra })
// 입력 변경 없음 → 통과하되 master 교정 결과를 대신 주장하지 않는다
let r = decide({ changed: ['src/lib/a.ts', 'scripts/ocr/ocr-check.mjs'], runs: [], headSha: SHA })
assert.equal(r.ok, true); assert.match(r.message, /이 PR의 검증 결과가 아니다/)
// 입력 변경 + 교정 실행 없음 → 실패(포크 PR 포함)
for (const f of ['scripts/ocr/ai-reader.mjs', 'scripts/ocr/ai-reader.test.mjs', 'scripts/ocr/ocr-compare.mjs', 'test-fixtures/ocr/x.png'])
  assert.equal(decide({ changed: [f], runs: [], headSha: SHA }).ok, false, f)
// 인정하는 실행: 같은 head 커밋의 workflow_dispatch 성공만
assert.equal(decide({ changed: ['scripts/ocr/ai-reader.mjs'], runs: [ok()], headSha: SHA }).ok, true)
for (const bad of [{ event: 'pull_request' }, { event: 'push' }, { head_sha: 'b'.repeat(40) }, { conclusion: 'failure' }, { status: 'in_progress', conclusion: null }])
  assert.equal(decide({ changed: ['scripts/ocr/ai-reader.mjs'], runs: [ok(bad)], headSha: SHA }).ok, false, JSON.stringify(bad))   // 같은 이름 PR 실행·다른 커밋·실패·진행 중은 불인정
// 이 가드를 들이는 PR 자신(교정 워크플로 추가 + 가드·시험 추가)은 판독 입력이 아니므로 순환 없이 통과한다 — 워크플로 변경은 아래 정적 시험과 두 번째 검토가 막는다
assert.equal(decide({ changed: ['.github/workflows/ai-reader-calibration.yml', '.github/workflows/occupation-publication-check.yml', 'scripts/ci/ai-reader-guard.mjs', 'scripts/ci/ai-reader-guard.test.mjs'], runs: [], headSha: SHA }).ok, true)
assert.deepEqual(readerInputsChanged(['a', 'scripts/ocr/ai-reader.mjs']), ['scripts/ocr/ai-reader.mjs'])

// 정적: PR이 돌리는 publication-gate 워크플로에는 Secret·API 키 참조가 없다(포크 PR 코드에 키를 주지 않는다)
const strip = (t) => t.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')
const gate = strip(readFileSync(new URL('../../.github/workflows/occupation-publication-check.yml', import.meta.url), 'utf8'))
assert.ok(!/secrets\.|ANTHROPIC/i.test(gate), 'publication-gate 워크플로에 Secret·ANTHROPIC 참조가 있으면 안 됨')
assert.ok(!/ai-reader\.test\.mjs/.test(gate), 'publication-gate는 키가 필요한 AI 판독 시험을 실행하지 않음')
// 정적: 교정 워크플로는 PR 이벤트로 돌지 않고(Secret은 신뢰된 실행에서만) 의존성 설치를 하지 않는다
const cal = strip(readFileSync(new URL('../../.github/workflows/ai-reader-calibration.yml', import.meta.url), 'utf8'))
const on = cal.slice(cal.indexOf('\non:'), cal.indexOf('\npermissions:'))
assert.ok(!/pull_request/.test(on), '교정 워크플로는 pull_request(_target) 트리거 금지: ' + on)
assert.ok(/workflow_dispatch/.test(on) && /push:/.test(on) && /schedule:/.test(on))
assert.ok(!/npm (?:i|ci|install)\b/.test(cal), '교정 워크플로는 의존성을 설치하지 않는다(PR이 바꾼 의존성에 키를 주지 않음)')
assert.ok(/ANTHROPIC_API_KEY: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/.test(cal) && /ai-reader\.test\.mjs/.test(cal))
console.log('ai-reader-guard: 판정·PR 경로 Secret 없음·교정 워크플로 PR 트리거 없음 시험 통과')

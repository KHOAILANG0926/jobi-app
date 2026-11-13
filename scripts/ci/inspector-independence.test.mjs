// 검사기 독립성 정적 시험(R2 #753): 공고 검사표(jobInspect.ts)는 만드는 쪽 함수로 "빠져도 되는 줄·기대값"을 다시 계산해 합격시키면 안 된다.
// jobInspect.ts는 상대 경로로 jobDetailSections(화면이 실제로 보여 주는 것 = 검사 대상)와 inspectReading(검사기 전용 읽기)만 import하고,
// inspectReading.ts는 아무것도 import하지 않는다. 다른 만드는 쪽 모듈을 끌어오면 실패한다(#734 S5는 '새' import만 막음 — 이 시험은 기존 구조를 고정).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const imports = (file) => [...readFileSync(new URL(`../../src/lib/${file}`, import.meta.url), 'utf8').matchAll(/^import\s+(?!type\b)[^\n]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)].map((m) => m[1])
const ALLOWED = new Set(['./jobDetailSections.ts', './inspectReading.ts'])
const bad = imports('jobInspect.ts').filter((i) => !ALLOWED.has(i))
assert.deepEqual(bad, [], `jobInspect.ts가 만드는 쪽 모듈을 import함(검사가 생산 규칙으로 합격 판정): ${bad.join(', ')}`)
// 화면 대조(screenAudit.ts)도 같다(R2 #753, Lee 2026-11-13): 제목·회사 줄 기대값을 화면이 쓰는 companyBranch 함수로 만들면 화면이 틀릴 때 같이 합격한다 — 검사기 전용 읽기(inspectReading)만 import.
const badAudit = imports('screenAudit.ts').filter((i) => i !== './inspectReading.ts')
assert.deepEqual(badAudit, [], `screenAudit.ts가 만드는 쪽 모듈을 import함: ${badAudit.join(', ')}`)
assert.deepEqual(imports('inspectReading.ts'), [], 'inspectReading.ts는 아무것도 import하지 않는다(독립)')
console.log('inspector-independence.test.mjs: jobInspect는 화면 함수(jobDetailSections)와 검사기 전용 읽기만, screenAudit은 검사기 전용 읽기만 사용')

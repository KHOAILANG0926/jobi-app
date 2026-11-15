// 결정 0003(2026-11-15 개정) 승인 범위 검사 시험: 허용 목록은 통과, 일반 파일·소유자 비움·핵심 항목 삭제는 빨간불
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { problems, ALLOWED, OWNER } from './check-approval-scope.mjs'
import { GATE_CODE, PROTECTED } from './decision-approval-gate.mjs'
const real = readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8')
assert.deepEqual(problems(real), [], '실제 CODEOWNERS는 허용 범위 안')
const base = [...ALLOWED].map((p) => `${p} ${OWNER}`).join('\n')
assert.deepEqual(problems(base), [])
assert.ok(problems(base + `\n/src/ ${OWNER}`).some((m) => /허용 안 된 항목: \/src\//.test(m)), '일반 폴더를 넣으면 빨간불(일반 PR 자동 병합 보호)')
assert.ok(problems(base + `\n/scripts/ ${OWNER}`).length, 'scripts 전체 같은 넓은 범위 금지')
assert.ok(problems(base + `\n* ${OWNER}`).length, '전체(*) 소유 금지 — 일반 PR 자동 병합이 막힘')
assert.ok(problems(base.replace(`/.github/ ${OWNER}`, '/.github/')).some((m) => /소유자/.test(m)), '소유자를 비워 승인 대상을 푸는 것 금지')
assert.ok(problems(base + '\n/docs/decisions/x @someone').length, '다른 소유자 금지')
assert.ok(problems(base.split('\n').filter((l) => !l.startsWith('/.github/')).join('\n')).some((m) => /필수 항목 없음: \/\.github\//.test(m)), '핵심 항목 삭제 금지')
// 허용 목록이 검사 장치 목록(GATE_CODE)·결정 문서(PROTECTED) 파일을 실제로 덮는다(GitHub CODEOWNERS 패턴을 단순 흉내)
const owned = (path) => [...ALLOWED].some((p) => { const g = p.slice(1); if (g.endsWith('/')) return path.startsWith(g); const [pre, suf] = g.split('*'); return suf === undefined ? path === g : path.startsWith(pre) && path.endsWith(suf) && !path.slice(pre.length, path.length - suf.length).includes('/') })
for (const f of ['.github/workflows/pr-checks.yml', '.github/CODEOWNERS', 'scripts/ci/claude-publish.mjs', 'scripts/status/x.mjs', 'scripts/check-approval-scope.mjs', 'scripts/decision-approval-gate.mjs', 'scripts/codex-review-gate.mjs', 'scripts/approved-migrations.mjs', 'AGENTS.md', 'docs/decisions/ko/0003-x.md']) {
  assert.ok(GATE_CODE(f) || PROTECTED(f), `검사 장치 목록에 있음: ${f}`); assert.ok(owned(f), `CODEOWNERS가 덮음: ${f}`)
}
// 일반 PR 자동 병합 유지: 일반 경로는 소유자 없음
for (const f of ['src/pages/Home.tsx', 'api/x.mjs', 'crawler/x.py', 'docs/ops/a.md', 'scripts/ops/x.mjs', 'supabase/migrations/20261201000000_x.sql', 'CLAUDE.md', 'package.json']) assert.ok(!owned(f), `일반 경로는 Lee 승인 불필요: ${f}`)
console.log('check-approval-scope 시험 통과(허용 범위·일반 경로 제외·핵심 경로 포함)')
// Lee 2026-11-15 결정 4: 보호 설정 검증 전에는 봇 자동 병합이 켜져 있어도 돌지 않는다(저장소 변수 S4_PROTECTION_VERIFIED가 'true'일 때만)
{ const bot = readFileSync(new URL('../.github/workflows/bot-pr-automerge.yml', import.meta.url), 'utf8')
  const live = bot.replace(/^\s*#.*$/gm, '')
  assert.match(live, /merge:\s*\n\s*if: >-\s*\n\s*vars\.S4_PROTECTION_VERIFIED == 'true' && \(/, '병합 잡 조건 맨 앞에 보호 검증 변수')
  const expr = live.slice(live.indexOf('vars.S4_PROTECTION_VERIFIED'), live.indexOf('runs-on: ubuntu-latest'))
  let depth = 0; for (const c of expr) { if (c === '(') depth++; if (c === ')') depth-- } assert.equal(depth, 0, '조건식 괄호 균형') }
console.log('봇 활성화 변수 시험 통과')

// 결정 0003(2026-11-15 개정) 승인 범위 검사 시험: 허용 목록은 통과, 일반 파일·소유자 비움·핵심 항목 삭제는 빨간불
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { problems } from './check-approval-scope.mjs'
import { OWNER_PATHS, OWNER_HANDLE, matchesOwnerPath, DECISION_DIR } from './ci/protected-paths.mjs'
import { GATE_CODE, PROTECTED } from './decision-approval-gate.mjs'
const real = readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8')
assert.deepEqual(problems(real), [], '실제 CODEOWNERS는 허용 범위 안')
const base = OWNER_PATHS.map((p) => `${p} ${OWNER_HANDLE}`).join('\n')
assert.deepEqual(problems(base), [])
assert.ok(problems(base + `\n/src/ ${OWNER_HANDLE}`).some((m) => /허용 안 된 항목: \/src\//.test(m)), '일반 폴더를 넣으면 빨간불(일반 PR 자동 병합 보호)')
assert.ok(problems(base + `\n/scripts/ ${OWNER_HANDLE}`).length, 'scripts 전체 같은 넓은 범위 금지')
assert.ok(problems(base + `\n* ${OWNER_HANDLE}`).length, '전체(*) 소유 금지 — 일반 PR 자동 병합이 막힘')
assert.ok(problems(base.replace(`/.github/CODEOWNERS ${OWNER_HANDLE}`, '/.github/CODEOWNERS')).some((m) => /소유자/.test(m)), '소유자를 비워 승인 대상을 푸는 것 금지')
assert.ok(problems(base + '\n/docs/decisions/x @someone').length, '다른 소유자 금지')
assert.ok(problems(base.split('\n').filter((l) => !l.startsWith('/.github/CODEOWNERS')).join('\n')).some((m) => /필수 항목 없음: \/\.github\/CODEOWNERS/.test(m)), '핵심 항목 삭제 금지')
// 허용 목록이 검사 장치 목록(GATE_CODE)·결정 문서(PROTECTED) 파일을 실제로 덮는다(GitHub CODEOWNERS 패턴을 단순 흉내)
const owned = (path) => matchesOwnerPath(path)  // CODEOWNERS가 덮는 파일 = 단일 목록(보호 대상)
for (const f of ['.github/workflows/pr-checks.yml', '.github/CODEOWNERS', 'scripts/ci/claude-publish.mjs', 'scripts/status/x.mjs', 'scripts/check-approval-scope.mjs', 'scripts/decision-approval-gate.mjs', 'scripts/codex-review-gate.mjs', 'scripts/approved-migrations.mjs', 'AGENTS.md', 'docs/decisions/ko/0003-x.md']) {
  assert.ok(GATE_CODE(f) || PROTECTED(f), `검사 장치 목록에 있음: ${f}`); assert.ok(owned(f), `CODEOWNERS가 덮음: ${f}`)
}
// 일반 PR 자동 병합 유지: 일반 경로는 소유자 없음
for (const f of ['src/pages/Home.tsx', 'api/x.mjs', 'crawler/x.py', 'docs/ops/a.md', 'scripts/ops/x.mjs', 'supabase/migrations/20261201000000_x.sql', 'package.json']) assert.ok(!owned(f), `일반 경로는 Lee 승인 불필요: ${f}`)
// Lee 2026-11-23 최종 지시: 규칙 문서 3개(AGENTS.md·CLAUDE.md·.claude/RULES_CORE.md)는 전체가 수동 Approve 대상
for (const f of ['AGENTS.md', 'CLAUDE.md', '.claude/RULES_CORE.md']) assert.ok(owned(f), `규칙 문서는 Lee 승인: ${f}`)
console.log('check-approval-scope 시험 통과(허용 범위·일반 경로 제외·핵심 경로 포함)')
// Lee 2026-11-15 결정 4: 보호 설정 검증 전에는 봇 자동 병합이 켜져 있어도 돌지 않는다(저장소 변수 S4_PROTECTION_VERIFIED가 'true'일 때만)
{ const bot = readFileSync(new URL('../.github/workflows/bot-pr-automerge.yml', import.meta.url), 'utf8')
  const live = bot.replace(/^\s*#.*$/gm, '')
  assert.match(live, /merge:\s*\n\s*if: >-\s*\n\s*vars\.S4_PROTECTION_VERIFIED == 'true' && \(/, '병합 잡 조건 맨 앞에 보호 검증 변수')
  const expr = live.slice(live.indexOf('vars.S4_PROTECTION_VERIFIED'), live.indexOf('runs-on: ubuntu-latest'))
  let depth = 0; for (const c of expr) { if (c === '(') depth++; if (c === ')') depth-- } assert.equal(depth, 0, '조건식 괄호 균형') }
console.log('봇 활성화 변수 시험 통과')
// 검토 지적 반영: 목록은 한 곳 — CODEOWNERS·Actions 승인 판정이 같은 목록에서 나오고, 보호 대상은 Lee 승인 필요·일반 파일은 승인 불필요로 판정된다
{ const { decisionApproval, GATE_CODE, PROTECTED } = await import('./decision-approval-gate.mjs')
  // CODEOWNERS 줄 = 단일 목록(양방향 같음)
  const rows = (await import('./check-approval-scope.mjs')).parseOwners(real).map((r) => r.path)
  assert.deepEqual([...rows].sort(), [...OWNER_PATHS].sort(), 'CODEOWNERS 항목이 단일 목록과 정확히 같음')
  // GATE_CODE 동작 보존(예전 정규식과 같은 결과): 경계 사례
  for (const [f, want] of [['.github/workflows/pr-checks.yml', true], ['.github/workflows/a.yml', false], ['.github/ISSUE_TEMPLATE/x.md', false], ['.github/CODEOWNERS', true], ['scripts/ci/protected-paths.mjs', true], ['scripts/status/x.mjs', true], ['scripts/check-x.mjs', true], ['scripts/codex-review-gate.mjs', true],
    ['scripts/approved-migrations.mjs', true], ['AGENTS.md', true], ['scripts/-gate.mjs', false], ['scripts/check-.mjs', false], ['scripts/ops/check-x.mjs', false], ['scripts/a/b-gate.mjs', false], ['scripts/check-x.mjs.bak', false],
    ['docs/AGENTS.md', false], ['src/a.ts', false], ['package.json', false], ['CLAUDE.md', true], ['.claude/RULES_CORE.md', true], ['docs/decisions/ko/0003-x.md', false]]) assert.equal(GATE_CODE(f), want, `GATE_CODE(${f})`)
  assert.equal(PROTECTED('docs/decisions/ko/0003-x.md'), true)
  // 판정: 보호 대상 파일 = 승인 필요(승인 전 막힘·Lee Approve 뒤 통과), 일반 파일 = 승인 불필요
  const sha = 'd'.repeat(40), lee = [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: sha, submitted_at: '2026-11-15T10:00:00Z' }]
  const body = ['## 고위험 4대 보고', '- 무엇을 바꾸나: 시험용 변경', '- 왜 필요한가: 시험용 이유', '- 승인 시 남는 위험: 시험용 위험', '- 미승인 시 영향: 시험용 영향', '- 검증: https://github.com/KHOAILANG0926/jobi-app/pull/1'].join('\n')
  const run = (f, reviews = []) => decisionApproval({ files: [{ filename: f, status: 'modified', patch: '@@\n+x' }], reviews, comments: [], sha, author: 'viecganban-bot', body, repo: 'KHOAILANG0926/jobi-app' })
  for (const f of ['docs/decisions/ko/0003-x.md', '.github/workflows/pr-checks.yml', '.github/CODEOWNERS', 'scripts/ci/claude-publish.mjs', 'scripts/status/report.mjs', 'scripts/check-repository-policy.mjs', 'scripts/codex-review-gate.mjs', 'scripts/approved-migrations.mjs', 'AGENTS.md']) {
    assert.ok(matchesOwnerPath(f), `CODEOWNERS 보호 대상: ${f}`)
    assert.equal(run(f).required, true, `승인 필요 판정: ${f}`); assert.equal(run(f).approved, false, `승인 전 막힘: ${f}`); assert.equal(run(f, lee).approved, true, `Lee Approve 뒤 통과: ${f}`)
  }
  for (const f of ['src/pages/Home.tsx', 'api/_lib/x.mjs', 'crawler/x.py', 'docs/ops/a.md', 'scripts/ops/x.mjs', 'WORK_LOG.md']) {
    assert.ok(!matchesOwnerPath(f), `CODEOWNERS 밖(일반): ${f}`)
    assert.equal(run(f).required, false, `승인 불필요 판정: ${f}`); assert.equal(run(f).approved, true, `일반 PR은 바로 통과: ${f}`)
  }
  assert.ok(!OWNER_PATHS.includes('/scripts/') && !OWNER_PATHS.includes('/src/') && !OWNER_PATHS.some((p) => p === '*' || p === '/*'), '넓은 범위 금지') }
console.log('보호 경로 단일 목록 시험 통과(CODEOWNERS = 승인 게이트 범위)')

// Lee 2026-11-23 정책 정렬(#1070 2순위): 워크플로 보호 목록은 내용 기준 — 권한·비밀값·실행기·필수 검사 워크플로는 반드시 목록에 있고, 일반 워크플로만 목록 밖이다
{ const { workflowCoverageProblems } = await import('./check-approval-scope.mjs')
  const { readdirSync } = await import('node:fs')
  const d = new URL('../.github/workflows/', import.meta.url)
  const files = Object.fromEntries(readdirSync(d).filter((f) => /\.ya?ml$/.test(f)).map((f) => ['.github/workflows/' + f, readFileSync(new URL(f, d), 'utf8')]))
  assert.deepEqual(workflowCoverageProblems(files), [], '실제 워크플로: 보호 대상은 모두 목록에 있고 목록 항목은 모두 존재')
  // 우회 시도: 일반 워크플로에 비밀값·쓰기 권한·pull_request_target·self-hosted·environment·필수 검사 이름을 넣으면 목록에 없다고 빨간불
  const plain = 'name: x\non:\n  workflow_dispatch:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n'
  assert.deepEqual(workflowCoverageProblems({ '.github/workflows/dup-count.yml': plain }).filter((m) => /보호 목록에 없음/.test(m)), [], '일반 워크플로는 목록 밖이어도 통과')
  for (const [why, text] of [['비밀값', plain.replace('echo hi', 'echo ${{ secrets.MY_KEY }}')], ['쓰기 권한', 'permissions:\n  contents: write\n' + plain], ['pull_request_target', plain.replace('workflow_dispatch', 'pull_request_target')], ['self-hosted', plain.replace('ubuntu-latest', 'self-hosted')], ['environment', plain.replace('    runs-on', '    environment: prod\n    runs-on')], ['필수 검사 이름(checks)', plain.replace('  t:', '  checks:')]])
    assert.ok(workflowCoverageProblems({ '.github/workflows/dup-count.yml': text }).some((m) => /보호 목록에 없음: \.github\/workflows\/dup-count\.yml/.test(m)), `일반 워크플로가 ${why}을(를) 가지면 목록에 없다고 막힘`)
  assert.ok(workflowCoverageProblems({ '.github/workflows/new-secret.yml': plain.replace('echo hi', 'echo ${{ secrets.K }}') }).length, '새 비밀값 워크플로도 목록 밖이면 막힘')
  console.log('워크플로 보호 목록 내용 기준 시험 통과')
}

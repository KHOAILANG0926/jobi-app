// AI 판독 교정 분리 시험(비밀키 없음): 판정 함수·import 그래프·실제 git 변경 목록·PR 경로 Secret 없음·교정 워크플로 PR 트리거 없음.
// Codex #806 보안 지적의 재현·차단: 이름 바꾸기 은닉·특수문자 파일명·간접 입력(import)·교정 워크플로 무력화·가드 사본·약한 Secret 검사·출력 주입.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decide, readerInputsChanged, importClosure, CALIBRATION_WORKFLOW_PATH } from './ai-reader-guard.mjs'

const GUARD = fileURLToPath(new URL('./ai-reader-guard.mjs', import.meta.url))
const SHA = 'a'.repeat(40)
const ok = (extra = {}) => ({ event: 'workflow_dispatch', head_sha: SHA, status: 'completed', conclusion: 'success', ...extra })

// ① 판정: 입력 변경 없음 → 통과하되 master 교정 결과를 대신 주장하지 않는다
let r = decide({ changed: ['src/lib/a.ts', 'scripts/ocr/ocr-check.mjs'], runs: [], headSha: SHA })
assert.equal(r.ok, true); assert.match(r.message, /이 PR의 검증 결과가 아니다/)
for (const f of ['scripts/ocr/ai-reader.mjs', 'scripts/ocr/ai-reader.test.mjs', 'scripts/ocr/ocr-compare.mjs', 'test-fixtures/ocr/x.png'])
  assert.equal(decide({ changed: [f], runs: [], headSha: SHA }).ok, false, f)
assert.equal(decide({ changed: ['scripts/ocr/ai-reader.mjs'], runs: [ok()], headSha: SHA }).ok, true)
for (const bad of [{ event: 'pull_request' }, { event: 'push' }, { head_sha: 'b'.repeat(40) }, { conclusion: 'failure' }, { status: 'in_progress', conclusion: null }])
  assert.equal(decide({ changed: ['scripts/ocr/ai-reader.mjs'], runs: [ok(bad)], headSha: SHA }).ok, false, JSON.stringify(bad))
// 이 가드를 들이는 PR 자신(교정 워크플로 신규 + 가드·시험 추가)은 판독 입력이 아니어서 순환 없이 통과한다
assert.equal(decide({ changed: [CALIBRATION_WORKFLOW_PATH, '.github/workflows/occupation-publication-check.yml', 'scripts/ci/ai-reader-guard.mjs'], runs: [], headSha: SHA, workflowExistsAtBase: false }).ok, true)

// ② 간접 입력: 교정 시험의 import 그래프(ocr-compare → src/lib/salaryReader.ts → …)가 바뀌어도 판독 입력 변경이다
const files = { 'scripts/ocr/ai-reader.test.mjs': "import { compareWithOcr } from './ocr-compare.mjs'\nimport { readImageAI } from './ai-reader.mjs'",
  'scripts/ocr/ocr-compare.mjs': "import { posterSalaryEvidence } from '../../src/lib/salaryReader.ts'", 'scripts/ocr/ai-reader.mjs': "import { readFileSync } from 'node:fs'",
  'src/lib/salaryReader.ts': "import { x } from './moneyParse'\nexport * from './unitWords'", 'src/lib/moneyParse.ts': '', 'src/lib/unitWords.ts': "const m = await import('./deep.js')", 'src/lib/deep.js': '' }
const closure = importClosure('scripts/ocr/ai-reader.test.mjs', (p) => files[p] ?? null)
for (const f of ['src/lib/salaryReader.ts', 'src/lib/moneyParse.ts', 'src/lib/unitWords.ts', 'src/lib/deep.js']) assert.ok(closure.has(f), `간접 입력 누락: ${f}`)
assert.equal(decide({ changed: ['src/lib/moneyParse.ts'], runs: [], headSha: SHA }).ok, true, '(수정 전 재현) 정적 목록만으로는 간접 입력 변경을 못 잡음')
assert.equal(decide({ changed: ['src/lib/moneyParse.ts'], runs: [], headSha: SHA, extraInputs: closure }).ok, false, 'import 그래프를 쓰면 막힘')
assert.deepEqual(readerInputsChanged(['a', 'src/lib/deep.js'], closure), ['src/lib/deep.js'])

// ③ 교정 워크플로 무력화: 입력 변경과 교정 워크플로 변경을 한 PR에 함께 둘 수 없다(바뀐 워크플로로 돈 실행은 증거가 아님)
r = decide({ changed: ['scripts/ocr/ai-reader.mjs', CALIBRATION_WORKFLOW_PATH], runs: [ok()], headSha: SHA, workflowExistsAtBase: true })
assert.equal(r.ok, false); assert.match(r.message, /함께 바꿀 수 없다/)

// ④ 출력 주입: 파일명에 workflow 명령·개행이 있어도 메시지에 그대로 실리지 않는다
r = decide({ changed: ['test-fixtures/ocr/a::error::pwn%0A\n::add-mask::x'], runs: [], headSha: SHA })
assert.equal(r.ok, false); assert.ok(!/[\r\n]/.test(r.message) && !/::error::pwn/.test(r.message) && !r.message.includes('%'), r.message)

// ⑤ 실제 git: 이름 바꾸기·특수문자 파일명·간접 입력을 실제 diff -z --no-renames와 CLI로 확인한다
const dir = mkdtempSync(join(tmpdir(), 'guard-'))
const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' })
const put = (p, t) => { mkdirSync(join(dir, p.split('/').slice(0, -1).join('/') || '.'), { recursive: true }); writeFileSync(join(dir, p), t) }
try {
  git('init', '-q'); git('config', 'user.email', 'a@b'); git('config', 'user.name', 'a')
  for (const [p, t] of Object.entries(files)) put(p, t)
  put('test-fixtures/ocr/x.png', 'png'); git('add', '-A'); git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD').trim()
  const runCli = (headLabel, runs = []) => {
    const head = git('rev-parse', 'HEAD').trim()
    writeFileSync(join(dir, '..', 'changed.bin'), execFileSync('git', ['diff', '-z', '--no-renames', '--name-only', base, head], { cwd: dir }))
    writeFileSync(join(dir, '..', 'runs.json'), JSON.stringify({ workflow_runs: runs.map((x) => ({ ...x, head_sha: head })) }))
    try { execFileSync('node', [GUARD, join(dir, '..', 'changed.bin'), join(dir, '..', 'runs.json')], { cwd: dir, env: { ...process.env, HEAD_SHA: head, BASE_SHA: base }, stdio: 'pipe' }); return 0 } catch (e) { return e.status }
  }
  // 이름 바꾸기로 교정 시험의 옛 경로를 숨겨도 막힌다(기본 git diff --name-only는 새 경로만 보여 줌 — 수정 전 재현)
  git('mv', 'scripts/ocr/ai-reader.test.mjs', 'scripts/moved.mjs'); git('commit', '-qam', 'rename')
  assert.ok(!execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { cwd: dir, encoding: 'utf8' }).includes('scripts/ocr/ai-reader.test.mjs'), '재현: 기본 diff는 옛 경로를 숨긴다')
  assert.equal(runCli('rename'), 1, '이름 바꾸기로 숨긴 판독 입력도 가드가 잡는다')
  git('reset', '-q', '--hard', base)
  // 특수문자 파일명(개행·따옴표)도 경로 검사를 피하지 못한다
  put('test-fixtures/ocr/we"ird\nname.png', 'x'); git('add', '-A'); git('commit', '-qm', 'weird')
  assert.equal(runCli('weird'), 1, '특수문자 파일명도 정답 포스터 변경으로 잡힘')
  git('reset', '-q', '--hard', base)
  // 간접 입력 변경
  put('src/lib/deep.js', '// changed'); git('add', '-A'); git('commit', '-qm', 'indirect')
  assert.equal(runCli('indirect'), 1, '간접 입력(import 그래프) 변경도 잡힘')
  assert.equal(runCli('indirect-evidence', [{ event: 'workflow_dispatch', status: 'completed', conclusion: 'success' }]), 0, '교정 실행 증거가 있으면 통과')
  assert.equal(runCli('indirect-pr-run', [{ event: 'pull_request', status: 'completed', conclusion: 'success' }]), 1, 'PR 이벤트 실행은 증거가 아님')
  git('reset', '-q', '--hard', base)
  // 판독 입력과 무관한 변경은 통과
  put('src/lib/unrelated.ts', 'x'); git('add', '-A'); git('commit', '-qm', 'unrelated')
  assert.equal(runCli('unrelated'), 0)
} finally { rmSync(dir, { recursive: true, force: true }) }

// ⑥ 정적: PR이 돌리는 publication-gate 워크플로에는 어떤 모양의 Secret 참조도 없고(secrets.X·secrets['X']·toJSON(secrets)·ANTHROPIC), 위험 트리거도 없다
const strip = (t) => t.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')
const noSecret = (t) => !/\bsecrets\b|ANTHROPIC|GITHUB_TOKEN\s*:\s*\$\{\{\s*secrets/i.test(t)
assert.equal(noSecret("env:\n  K: ${{ secrets['ANTHROPIC_API_KEY'] }}"), false, '대괄호 모양 Secret도 잡음(수정 전 정규식 /secrets\\./는 놓침)')
assert.equal(noSecret('x: ${{ toJSON(secrets) }}'), false)
assert.equal(/secrets\./.test("env:\n  K: ${{ secrets['ANTHROPIC_API_KEY'] }}"), false, '재현: 옛 정규식은 대괄호 모양을 놓침')
const gateRaw = readFileSync(new URL('../../.github/workflows/occupation-publication-check.yml', import.meta.url), 'utf8')
const gate = strip(gateRaw)
assert.ok(noSecret(gate), 'publication-gate 워크플로에 Secret 참조가 있으면 안 됨')
assert.ok(!/ai-reader\.test\.mjs/.test(gate), 'publication-gate는 키가 필요한 AI 판독 시험을 실행하지 않음')
assert.ok(!/^\s*(?:pull_request_target|workflow_run)\s*:/m.test(gate), 'publication-gate는 pull_request_target·workflow_run 트리거 금지')
assert.ok(/git show "\$BASE_SHA:scripts\/ci\/ai-reader-guard\.mjs"/.test(gate) && /RUNNER_TEMP\/ai-reader-guard\.mjs/.test(gate), '가드는 기준 커밋의 사본으로 실행')
assert.ok(/git diff -z --no-renames --name-only/.test(gate), '변경 목록은 -z --no-renames')
// ⑦ 정적: 교정 워크플로는 PR 이벤트로 돌지 않고(Secret은 신뢰된 실행에서만) 의존성 설치를 하지 않는다
const cal = strip(readFileSync(new URL('../../.github/workflows/ai-reader-calibration.yml', import.meta.url), 'utf8'))
const on = cal.slice(cal.indexOf('\non:'), cal.indexOf('\npermissions:'))
assert.ok(!/^\s*(?:pull_request(?:_target)?|workflow_run)\s*:/m.test(on), '교정 워크플로는 pull_request(_target)·workflow_run 트리거 금지: ' + on)
assert.ok(/workflow_dispatch/.test(on) && /push:/.test(on) && /schedule:/.test(on))
assert.ok(!/npm (?:i|ci|install)\b/.test(cal), '교정 워크플로는 의존성을 설치하지 않는다(PR이 바꾼 의존성에 키를 주지 않음)')
assert.ok(/ANTHROPIC_API_KEY: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/.test(cal) && /ai-reader\.test\.mjs/.test(cal))
console.log('ai-reader-guard: 판정·import 그래프·실제 git(이름 바꾸기·특수문자·간접 입력)·가드 사본·Secret 정적 시험 통과')

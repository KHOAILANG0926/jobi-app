// AI 판독 교정 분리 시험(비밀키 없음): 판정 함수·import 그래프·실제 git 변경 목록·PR 경로 Secret 없음·교정 워크플로 PR 트리거 없음.
// Codex #806 보안 지적의 재현·차단: 이름 바꾸기 은닉·특수문자 파일명·간접 입력(import)·교정 워크플로 무력화·가드 사본·약한 Secret 검사·출력 주입.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decide, readerInputsChanged, importClosure, CALIBRATION_WORKFLOW_PATH, GATE_WORKFLOW_PATH, calibrationWorkflowProblems, gateWorkflowProblems } from './ai-reader-guard.mjs'

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
  const realWf = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
  put(GATE_WORKFLOW_PATH, realWf(GATE_WORKFLOW_PATH)); put(CALIBRATION_WORKFLOW_PATH, realWf(CALIBRATION_WORKFLOW_PATH))
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
  // 교정 단계 비활성화: 입력과 무관해도 head의 교정·검사 워크플로가 무력화되면(시험 실행 제거·if·실패 무시) 기준 사본 가드가 head 파일을 읽어 막는다
  put(CALIBRATION_WORKFLOW_PATH, realWf(CALIBRATION_WORKFLOW_PATH).replace('run: node --experimental-strip-types scripts/ocr/ai-reader.test.mjs', 'run: echo skipped')); git('add', '-A'); git('commit', '-qm', 'neuter')
  assert.equal(runCli('neutered'), 1, '교정 시험을 빼 무력화한 워크플로는 입력 변경이 없어도 막힘')
  git('reset', '-q', '--hard', base)
  // 증거 위조: 판독 입력 변경 + 무력화한 교정 워크플로 + 그 워크플로로 돈 dispatch 성공 → 증거로 인정하지 않는다
  put('scripts/ocr/ai-reader.mjs', "import { readFileSync } from 'node:fs' // changed"); put(CALIBRATION_WORKFLOW_PATH, realWf(CALIBRATION_WORKFLOW_PATH).replace('run: node --experimental-strip-types scripts/ocr/ai-reader.test.mjs', 'run: echo skipped')); git('add', '-A'); git('commit', '-qm', 'forge')
  assert.equal(runCli('forged', [{ event: 'workflow_dispatch', status: 'completed', conclusion: 'success' }]), 1, '무력화한 워크플로로 돈 성공 실행은 위조 증거')
  git('reset', '-q', '--hard', base)
  // 검사 워크플로에서 가드 호출을 빼거나 PR 사본 가드로 바꿔도 막힘(가드 자체가 돌 때)
  put(GATE_WORKFLOW_PATH, realWf(GATE_WORKFLOW_PATH).replace(/node "\$RUNNER_TEMP\/ai-reader-guard\.mjs"[^\n]*/, 'node scripts/ci/ai-reader-guard.mjs changed-files.bin calibration-runs.json')); git('add', '-A'); git('commit', '-qm', 'pr-copy')
  assert.equal(runCli('pr-copy-guard'), 1, '가드를 기준 사본이 아닌 PR 사본으로 실행하게 바꾸면 막힘')
  git('reset', '-q', '--hard', base)
  // 판독 입력과 무관한 변경은 통과
  put('src/lib/unrelated.ts', 'x'); git('add', '-A'); git('commit', '-qm', 'unrelated')
  assert.equal(runCli('unrelated'), 0)
} finally { rmSync(dir, { recursive: true, force: true }) }

// ⑥ 워크플로 무결성 검사기: 실제 두 파일은 통과, 무력화 변형은 각각 잡힌다(PR 검사 경로에 키 없음·교정 시험은 PR 이벤트 없이 실제 실행)
const readWf = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const gateText = readWf(GATE_WORKFLOW_PATH), calText = readWf(CALIBRATION_WORKFLOW_PATH)
assert.deepEqual(gateWorkflowProblems(gateText), [], '실제 publication-gate 워크플로')
assert.deepEqual(calibrationWorkflowProblems(calText), [], '실제 교정 워크플로')
const hit = (fn, text, re, msg) => assert.ok(fn(text).some((x) => re.test(x)), `${msg}: ${JSON.stringify(fn(text))}`)
hit(gateWorkflowProblems, gateText + "\n          K: ${{ secrets['ANTHROPIC_API_KEY'] }}", /Secret/, '대괄호 Secret')
assert.equal(/secrets\./.test("K: ${{ secrets['ANTHROPIC_API_KEY'] }}"), false, '재현: 옛 정규식은 대괄호 모양을 놓침')
hit(gateWorkflowProblems, gateText + '\n  x: ${{ toJSON(secrets) }}', /Secret/, 'toJSON(secrets)')
hit(gateWorkflowProblems, gateText.replace(/^on:\n/m, 'on:\n  pull_request_target:\n  workflow_run:\n'), /pull_request_target/, '위험 트리거')
hit(gateWorkflowProblems, gateText + '\n          node scripts/ocr/ai-reader.test.mjs', /AI 판독 시험/, '키 필요한 시험 실행')
hit(gateWorkflowProblems, gateText.replace(/node "\$RUNNER_TEMP\/ai-reader-guard\.mjs"[^\n]*/, 'node scripts/ci/ai-reader-guard.mjs x y'), /기준 커밋의 가드/, '가드 PR 사본 실행')
hit(gateWorkflowProblems, gateText.replace(/(node "\$RUNNER_TEMP\/ai-reader-guard\.mjs"[^\n]*)/, '$1 || true'), /무시/, '가드 실패 무시')
hit(gateWorkflowProblems, gateText.replace('git diff -z --no-renames --name-only', 'git diff --name-only'), /-z --no-renames/, '이름 바꾸기 은닉')
hit(gateWorkflowProblems, gateText.replace("if: github.event_name == 'pull_request'", 'if: false'), /실행 조건/, '가드 단계 건너뛰기')
hit(gateWorkflowProblems, gateText.replace('      - name: AI reader inputs guard (keyless)', '      - name: renamed'), /가드 단계가 없거나/, '가드 단계 제거')
const RUN = /run: node --experimental-strip-types scripts\/ocr\/ai-reader\.test\.mjs/
hit(calibrationWorkflowProblems, calText.replace(/^on:\n/m, 'on:\n  pull_request:\n'), /PR·workflow_run 트리거/, '교정 워크플로 PR 트리거')
hit(calibrationWorkflowProblems, calText.replace(RUN, 'run: echo skipped'), /그대로 실행하지 않는다/, '시험 제거')
hit(calibrationWorkflowProblems, calText.replace(RUN, '$& || true'), /그대로 실행하지 않는다|삼키는/, '실패 삼킴')
hit(calibrationWorkflowProblems, calText.replace('      - name: Independent', '      - if: false\n        run: echo x\n      - name: Independent'), /if·continue-on-error/, 'if 비활성화')
hit(calibrationWorkflowProblems, calText.replace('timeout-minutes: 10', 'timeout-minutes: 10\n    continue-on-error: true'), /if·continue-on-error/, 'continue-on-error')
hit(calibrationWorkflowProblems, calText.replace('      - name: Independent', '      - run: npm ci\n      - name: Independent'), /의존성/, '의존성 설치')
hit(calibrationWorkflowProblems, calText + '\n          OTHER: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}', /외의 Secret/, '다른 Secret')
hit(calibrationWorkflowProblems, calText.replace(/  schedule:\n    - cron: '[^']+'\n/, ''), /schedule/, '정기 실행 제거')
console.log('ai-reader-guard: 판정·import 그래프·실제 git(이름 바꾸기·특수문자·간접 입력·무력화·위조·가드 사본)·워크플로 무결성 시험 통과')

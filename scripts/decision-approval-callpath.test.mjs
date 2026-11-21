// S4-4 실제 호출 경로 시험(Lee 2026-11-15 최종 확인 ①②):
//  ① 리뷰가 100건을 넘어도(여러 쪽) 최신 유효 승인을 정확히 판단 — 병합 실행기 CLI와 정책 검사(check-repository-policy) 둘 다
//  ② 자기 승인 차단이 병합 판정에서 실제로 작동 — bot-pr-automerge가 작성자를 8번째 인자로 넘기고, CLI가 그 값으로 판정
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, chmodSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEE = 'KHOAILANG0926'
const head = 'a'.repeat(40), old = 'b'.repeat(40)
const t = (i) => new Date(Date.UTC(2026, 10, 15, 0, 0, i)).toISOString()
// 150건: 앞쪽은 다른 계정 의견·Lee의 옛 커밋 승인, 마지막 쪽에 Lee의 최신 결정 리뷰
const many = (last) => [
  ...Array.from({ length: 120 }, (_, i) => ({ user: { login: 'chatgpt-codex-connector[bot]' }, state: 'COMMENTED', commit_id: head, submitted_at: t(i) })),
  { user: { login: LEE }, state: 'APPROVED', commit_id: old, submitted_at: t(121) },
  ...Array.from({ length: 28 }, (_, i) => ({ user: { login: 'viecganban-bot' }, state: 'COMMENTED', commit_id: head, submitted_at: t(122 + i) })),
  { user: { login: LEE }, ...last, submitted_at: t(200) },
]
const dir = mkdtempSync(join(tmpdir(), 'dag-'))
const w = (name, v) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(v)); return p }
const files = w('files.json', [{ filename: '.github/workflows/status-report.yml', status: 'modified' }])
const comments = w('comments.json', []), labels = w('labels.json', []), deps = w('deps.json', {})
const bodyFile = join(dir, 'body.txt')
writeFileSync(bodyFile, ['## 고위험 4대 보고', '- 무엇을 바꾸나: 시험용 변경 내용', '- 왜 필요한가: 시험용 이유 설명', '- 승인 시 남는 위험: 시험용 남는 위험', '- 미승인 시 영향: 시험용 영향 설명', '- 검증: https://github.com/KHOAILANG0926/jobi-app/actions/runs/1', ''].join('\n'))
const cli = (reviews, author) => spawnSync('node', [join(ROOT, 'scripts/decision-approval-gate.mjs'), files, w('reviews.json', reviews), comments, head, labels, deps, ...(author === undefined ? [] : [author, bodyFile, 'KHOAILANG0926/jobi-app'])], { encoding: 'utf8' }).status

// ① 병합 실행기 CLI — 150건 중 마지막 쪽의 최신 결정 리뷰로 판정
assert.equal(cli(many({ state: 'APPROVED', commit_id: head }), 'viecganban-bot'), 0, '150건 중 마지막에 지금 커밋 승인 → 병합 가능')
assert.equal(cli(many({ state: 'CHANGES_REQUESTED', commit_id: head }), 'viecganban-bot'), 3, '마지막이 변경 요청 → 막힘')
assert.equal(cli(many({ state: 'APPROVED', commit_id: old }), 'viecganban-bot'), 3, '마지막 승인이 옛 커밋 → 막힘')
assert.equal(cli(many({ state: 'DISMISSED', commit_id: head }), 'viecganban-bot'), 3, 'S4: 승인 취소(DISMISSED)가 마지막 결정이면 막힘')
assert.equal(cli([...many({ state: 'APPROVED', commit_id: head }), { user: { login: LEE }, state: 'DISMISSED', commit_id: head, submitted_at: t(300) }], 'viecganban-bot'), 3, 'S4: 승인 뒤 승인 취소 → 병합 직전 재확인에서 막힘')
// ② 자기 승인 — 실제 CLI 인자로
assert.equal(cli(many({ state: 'APPROVED', commit_id: head }), LEE), 3, 'PR 작성자가 Lee 계정이면 Lee 승인 무효')
assert.equal(cli(many({ state: 'APPROVED', commit_id: head }), ''), 3, '작성자를 모르면(빈 값) 승인 없음')
assert.equal(cli(many({ state: 'APPROVED', commit_id: head }), undefined), 3, '작성자 인자를 안 넘기면 승인 없음')
// 승인이 필요 없는 PR은 작성자 인자와 상관없이 그대로 통과
{ const plain = w('plain.json', [{ filename: 'src/lib/x.ts', status: 'modified', patch: '+x' }])
  const r = spawnSync('node', [join(ROOT, 'scripts/decision-approval-gate.mjs'), plain, w('r0.json', []), comments, head, labels, deps], { encoding: 'utf8' }).status
  assert.equal(r, 0, '승인 대상이 아닌 PR은 영향 없음') }

// ② 실제 병합 실행기 연결: bot-pr-automerge.yml이 PR 목록에서 작성자를 받아 8번째 인자로 넘김
{ const yml = readFileSync(join(ROOT, '.github/workflows/bot-pr-automerge.yml'), 'utf8')
  assert.match(yml, /--json [^ ]*\bauthor\b/, 'PR 목록 조회에 작성자 포함')
  assert.match(yml, /read -r num sha branch author; do/, '작성자를 변수로 읽음')
  assert.match(yml, /decision-approval-gate\.mjs files\.json reviews\.json comments\.json "\$sha" labels\.json deps\.json "\$author"/, '작성자를 승인 판정에 넘김')
  assert.match(yml, /pulls\/\$num\/reviews\?per_page=100" --paginate --slurp/, '리뷰는 전체 쪽 조회')
  // S4 ①: 순서 = 필수 검사 → Lee 승인 판정·요청 → 병합(검증이 덜 된 PR에 승인을 요청하지 않음).
  // 독립 검토는 병합 조건이 아니다(Lee 2026-11-21) — 봇은 검토를 기다리지도 검토관을 부르지도 않는다.
  const at = (re) => { const m = yml.search(re); assert.ok(m >= 0, String(re)); return m }
  const checksAt = at(/required-checks-pass\.jq/), approvalAt = at(/node scripts\/decision-approval-gate\.mjs /), mergeAt = at(/pulls\/\$num\/merge"/)
  assert.ok(checksAt < approvalAt && approvalAt < mergeAt, '필수 검사 → Lee 승인 → 병합 순서')
  assert.doesNotMatch(yml, /node scripts\/codex-review-gate\.mjs /, '봇이 독립 검토를 기다리지 않음(11-21)')
  assert.doesNotMatch(yml, /-f fallback_pr=/, '봇이 검토관을 자동으로 부르지 않음(수동만, 11-21)')
  // S4 병합 직전 실시간 승인 재검증: 병합 API 호출 바로 앞에서 리뷰·댓글·라벨·본문을 다시 받아 같은 판정기를 한 번 더 부른다
  const gateCalls = [...yml.matchAll(/node scripts\/decision-approval-gate\.mjs files\.json reviews\.json comments\.json "\$sha" labels\.json deps\.json "\$author" pr-body\.txt "\$REPO"/g)].map((m) => m.index)
  assert.equal(gateCalls.length, 2, '승인 판정기 호출 2번(첫 판정 + 병합 직전)')
  const titleAt = yml.search(/title=\$\(gh api/)
  assert.ok(titleAt < gateCalls[1] && gateCalls[1] < mergeAt, '두 번째 판정은 병합 API 바로 앞')
  assert.match(yml.slice(gateCalls[1] - 900, gateCalls[1]), /reviews\?per_page=100" --paginate --slurp \| jq 'add \/\/ \[\]' > reviews\.json/, '병합 직전에 리뷰를 다시 받음')
  assert.match(yml.slice(gateCalls[1], gateCalls[1] + 400), /병합 중단"; continue/, '막히면 병합 안 함') }

// ① 정책 검사(check-repository-policy) 실제 실행 — 가짜 gh가 리뷰 150건을 두 쪽(100+50)으로 돌려줌(--paginate --slurp 모양)
{
  const repo = join(dir, 'repo'); mkdirSync(join(repo, 'scripts'), { recursive: true })
  // decision-approval-gate.mjs는 보호 경로 단일 목록(ci/protected-paths.mjs)을 불러온다 — 시험용 작은 저장소에도 그 파일까지 넣어야 실제 배치와 같다(2026-11-15 #842 CI 실패 원인).
  mkdirSync(join(repo, 'scripts', 'ci'), { recursive: true })
  for (const f of ['check-repository-policy.mjs', 'decision-approval-gate.mjs', 'approved-migrations.mjs', 'ci/protected-paths.mjs']) cpSync(join(ROOT, 'scripts', f), join(repo, 'scripts', f))
  const g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: repo, encoding: 'utf8' })
  g('init', '-q'); mkdirSync(join(repo, '.github/workflows'), { recursive: true })
  writeFileSync(join(repo, '.github/workflows/status-report.yml'), 'on: push\n'); g('add', '-A'); g('commit', '-qm', 'base')
  const base = g('rev-parse', 'HEAD').trim()
  writeFileSync(join(repo, '.github/workflows/status-report.yml'), 'on: push\n# x\n'); g('commit', '-qam', 'change')
  const sha = g('rev-parse', 'HEAD').trim()
  const bin = join(dir, 'bin'); mkdirSync(bin)
  const run = (last, author) => {
    const list = many(last).map((r) => ({ ...r, commit_id: r.commit_id === head ? sha : r.commit_id }))
    writeFileSync(join(dir, 'pages.json'), JSON.stringify([list.slice(0, 100), list.slice(100)]))
    writeFileSync(join(bin, 'gh'), `#!/bin/sh\ncase "$*" in *reviews*) case "$*" in *--paginate*--slurp*) cat "${join(dir, 'pages.json')}";; *) exit 1;; esac;; *) echo '[]';; esac\n`); chmodSync(join(bin, 'gh'), 0o755)
    writeFileSync(join(dir, 'event.json'), JSON.stringify({ pull_request: { number: 1, base: { sha: base }, head: { sha }, user: { login: author }, body: '' } }))
    return spawnSync('node', ['scripts/check-repository-policy.mjs'], { cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_REPOSITORY: 'x/y' } })
  }
  // S1 후속(Lee 2026-11-20): status 워크플로의 대표 승인 판정은 approval-gate 한 곳(위 cli(...) 시험이 리뷰 150건·두 쪽·작성자 인자를 이미 본다).
  // 정책 검사는 리뷰를 읽지 않고, 승인 대기만으로 실패하지 않는다 — 어떤 리뷰 상태여도 같은 결과(책임 이동).
  for (const [label, last, author] of [['승인', { state: 'APPROVED', commit_id: head }, 'viecganban-bot'], ['변경 요청', { state: 'CHANGES_REQUESTED', commit_id: head }, 'viecganban-bot'],
    ['옛 커밋 승인', { state: 'APPROVED', commit_id: old }, 'viecganban-bot'], ['Lee 작성 PR', { state: 'APPROVED', commit_id: head }, LEE], ['작성자 없음', { state: 'APPROVED', commit_id: head }, undefined]])
    assert.equal(run(last, author).status, 0, `정책 검사: status 워크플로 변경은 리뷰 상태(${label})와 상관없이 승인 대기만으로 실패하지 않음 — 승인은 approval-gate`)
  // 반대로 STATUS.md·scripts/status/는 대표 승인이 있어도 무조건 실패
  mkdirSync(join(repo, 'scripts/status'), { recursive: true })
  writeFileSync(join(repo, 'STATUS.md'), 'x\n'); writeFileSync(join(repo, 'scripts/status/a.mjs'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'status direct edit')
  const sha2 = g('rev-parse', 'HEAD').trim()
  writeFileSync(join(dir, 'pages.json'), JSON.stringify([[{ user: { login: LEE }, state: 'APPROVED', commit_id: sha2, submitted_at: t(10) }], []]))
  writeFileSync(join(dir, 'event.json'), JSON.stringify({ pull_request: { number: 1, base: { sha: base }, head: { sha: sha2 }, user: { login: 'viecganban-bot' }, body: '' } }))
  const direct = spawnSync('node', ['scripts/check-repository-policy.mjs'], { cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_REPOSITORY: 'x/y' } })
  assert.equal(direct.status, 1, '정책 검사: STATUS.md·scripts/status/ 직접 수정은 최신 SHA 대표 승인이 있어도 실패')
  assert.match(direct.stderr, /STATUS\.md/); assert.match(direct.stderr, /scripts\/status\/a\.mjs/)
}
console.log('decision-approval 실제 호출 경로 시험 통과(리뷰 150건·두 쪽, 작성자 인자)')

// ── S1(Lee 2026-11-20): 병합 조건 M1~M7 — 테스트 데이터만 쓴다(실제 병합·GitHub 호출 없음). 병합 실행기(bot-pr-automerge.yml)의 실제 조각을 그대로 불러 모은다:
//    Draft 확인 = 워크플로의 그 셸 단계를 가짜 gh로 실행 / 대표 승인 = decision-approval-gate.mjs CLI / 병합 조건 검사 = merge-gate-ready.jq / 필수 4종 = collapse-check-runs.jq + required-checks-pass.jq.
{
  const yml = readFileSync(join(ROOT, '.github/workflows/bot-pr-automerge.yml'), 'utf8')
  const m = yml.match(/for try in 1 2 3 4 5; do[\s\S]*?HEAD 변경 또는 Draft: 병합 안 함"; continue;\n\s*\}/)
  assert.ok(m, 'bot-pr-automerge.yml에서 Draft·head 확인 단계를 찾음')
  const bin = join(dir, 'm-bin'); mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nprintf "%s\\t%s\\t%s\\n" "$FAKE_HEAD" "$FAKE_DRAFT" clean\n'); chmodSync(join(bin, 'gh'), 0o755)
  // 1) Draft·head 확인(병합 실행기 그대로): 끝까지 가면 MERGE_REACHED
  const draftStep = ({ draft, current = head }) => spawnSync('bash', ['-c', `REPO=x/y; num=1; sha=${head}\nfor item in once; do\n${m[0]}\necho MERGE_REACHED\ndone`],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_HEAD: current, FAKE_DRAFT: String(draft) } }).stdout.includes('MERGE_REACHED')  // 단계가 state.txt를 쓰므로 임시 폴더에서 실행
  const jq = (args, input) => spawnSync('jq', args, { input: JSON.stringify(input), encoding: 'utf8' })
  const cr = (name, status, conclusion, slug = 'viecganban-checks', id = 1) => ({ id, name, status, conclusion, started_at: '2026-11-20T00:00:00Z', check_suite: { id }, app: { slug } })
  const ok = (name, slug) => cr(name, 'completed', 'success', slug)
  const required = (extra = []) => [ok('checks', 'github-actions'), ok('guard', 'github-actions'), ok('app-screen', 'github-actions'), ok('publication-gate', 'github-actions'), ...extra]
  // 2) 병합 직전 판정 = 위 조각 전부 통과해야 병합 조건 충족
  const mergeable = ({ draft = false, reviews, runs = [ok('ai-review'), ok('approval-gate')], req = required(), current = head }) => {
    const why = []
    if (!draftStep({ draft, current })) why.push('draft')
    if (cli(reviews, 'viecganban-bot') !== 0) why.push('approval')
    const all = [...req, ...runs]
    const gate = jq(['-r', '-f', join(ROOT, 'scripts/ci/merge-gate-ready.jq')], { check_runs: all }).stdout.trim()
    if (gate !== 'ok') why.push(`merge-gate:${gate}`)
    const collapsed = jq(['-c', '-f', join(ROOT, 'scripts/ci/collapse-check-runs.jq')], { check_runs: all, total_count: all.length }).stdout
    if (jq(['-e', '-f', join(ROOT, 'scripts/ci/required-checks-pass.jq')], JSON.parse(collapsed)).status !== 0) why.push('required-checks')
    return { merge: why.length === 0, why }
  }
  const lee = (state, commit_id, at) => ({ user: { login: LEE }, state, commit_id, submitted_at: t(at) })
  const approved = [lee('APPROVED', head, 10)]

  const r1 = mergeable({ draft: true, reviews: approved }); assert.deepEqual([r1.merge, r1.why], [false, ['draft']], 'M1: Draft는 승인·검사가 모두 성공해도 병합 불가')
  const r2 = mergeable({ reviews: [] }); assert.equal(r2.merge, false, 'M2: Ready지만 대표 Approve 없으면 병합 불가'); assert.ok(r2.why.includes('approval'), 'M2 사유=대표 승인')
  assert.equal(mergeable({ reviews: [lee('COMMENTED', head, 10)] }).merge, false, 'M2: 대표 의견(COMMENTED)만으로는 승인 아님')
  assert.equal(mergeable({ reviews: [{ user: { login: 'viecganban-bot' }, state: 'APPROVED', commit_id: head, submitted_at: t(10) }] }).merge, false, 'M2: 봇 승인은 대표 승인 아님')
  const r3 = mergeable({ reviews: approved, runs: [ok('ai-review'), cr('approval-gate', 'completed', 'action_required')] }); assert.equal(r3.merge, false, 'M3: approval-gate action_required면 병합 불가'); assert.deepEqual(r3.why, ['merge-gate:pending'])
  // M4(Lee 2026-11-21 변경): ai-review(독립 검토)는 병합 조건이 아니다 — 진행 중·neutral·없음이어도 approval-gate가 성공이면 병합 조건 충족
  for (const rv of [cr('ai-review', 'in_progress', null), cr('ai-review', 'completed', 'neutral'), null]) {
    const r4 = mergeable({ reviews: approved, runs: [...(rv ? [rv] : []), ok('approval-gate')] }); assert.deepEqual([r4.merge, r4.why], [true, []], `M4: ai-review ${rv ? rv.status + '/' + rv.conclusion : '없음'}이어도 병합 조건에 영향 없음`)
  }
  const r5 = mergeable({ reviews: [lee('APPROVED', old, 10)] }); assert.equal(r5.merge, false, 'M5: 이전 SHA 승인은 무효'); assert.deepEqual(r5.why, ['approval'])
  const r6a = mergeable({ reviews: [lee('APPROVED', head, 10), lee('DISMISSED', head, 20)] }); assert.deepEqual([r6a.merge, r6a.why], [false, ['approval']], 'M6: 최신 SHA 승인 취소(DISMISSED)면 병합 불가')
  const r6b = mergeable({ reviews: [lee('APPROVED', head, 10), lee('CHANGES_REQUESTED', head, 20)] }); assert.deepEqual([r6b.merge, r6b.why], [false, ['approval']], 'M6: 승인 뒤 변경 요청도 병합 불가')
  const r7 = mergeable({ reviews: approved }); assert.deepEqual([r7.merge, r7.why], [true, []], 'M7: 최신 SHA 공식 Approve + 모든 필수 검사 성공 → 병합 조건 충족')
  // M7은 '모두'가 조건이다: 하나라도 빠지면 충족 아님(대조)
  assert.equal(mergeable({ reviews: approved, req: required().filter((c) => c.name !== 'guard') }).merge, false, 'M7 대조: 필수 검사 guard 없음 → 불충족')
  assert.equal(mergeable({ reviews: approved, req: [...required().filter((c) => c.name !== 'checks'), cr('checks', 'completed', 'failure', 'github-actions')] }).merge, false, 'M7 대조: checks 실패 → 불충족')
  assert.equal(mergeable({ reviews: approved, current: 'c'.repeat(40) }).merge, false, 'M7 대조: head가 그새 바뀌면(승인한 SHA와 다름) 불충족')
  console.log('S1 병합 조건 M1~M7(+대조) 시험 통과 — 테스트 데이터만 사용, 실제 병합 없음')
}

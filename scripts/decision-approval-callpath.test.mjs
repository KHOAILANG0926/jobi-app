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
  // S4 ①: 순서 = 필수 검사 → 독립 검토 → Lee 승인 판정·요청 → 병합(검증이 덜 된 PR에 승인을 요청하지 않음)
  const at = (re) => { const m = yml.search(re); assert.ok(m >= 0, String(re)); return m }
  const checksAt = at(/required-checks-pass\.jq/), reviewAt = at(/node scripts\/codex-review-gate\.mjs /), approvalAt = at(/node scripts\/decision-approval-gate\.mjs /), mergeAt = at(/pulls\/\$num\/merge"/)
  assert.ok(checksAt < reviewAt && reviewAt < approvalAt && approvalAt < mergeAt, '필수 검사 → 독립 검토 → Lee 승인 → 병합 순서')
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
  assert.equal(run({ state: 'APPROVED', commit_id: head }, 'viecganban-bot').status, 0, '정책 검사: 두 쪽 150건, 마지막 쪽 지금 커밋 승인 → 통과')
  assert.equal(run({ state: 'CHANGES_REQUESTED', commit_id: head }, 'viecganban-bot').status, 1, '정책 검사: 마지막이 변경 요청 → 실패')
  assert.equal(run({ state: 'APPROVED', commit_id: old }, 'viecganban-bot').status, 1, '정책 검사: 승인 뒤 코드 바뀜(옛 커밋) → 실패')
  assert.equal(run({ state: 'APPROVED', commit_id: head }, LEE).status, 1, '정책 검사: Lee 계정이 쓴 PR → 실패')
  assert.equal(run({ state: 'APPROVED', commit_id: head }, undefined).status, 1, '정책 검사: 작성자 정보가 없으면 → 실패')
}
console.log('decision-approval 실제 호출 경로 시험 통과(리뷰 150건·두 쪽, 작성자 인자)')

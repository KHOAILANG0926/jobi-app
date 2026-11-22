// S4 8단계 시험: approval-gate 판정(순수 함수) — ai-review 검사는 11-21 Ruleset에서 빠진 뒤 지움 — 일반 통과 / 고위험·판단 불가 차단 / Lee 승인. 독립 검토·4대 보고는 병합 조건 아님(Lee 2026-11-21)
import assert from 'node:assert/strict'
import * as checks from './approval-checks.mjs'
const { verdicts, CHECK_APPROVAL } = checks
import { readFileSync } from 'node:fs'
const sha = 'a'.repeat(40), repo = 'KHOAILANG0926/jobi-app'
const headDate = '2026-11-15T10:00:00Z', later = new Date('2026-11-15T10:30:00Z')
const body = ['## 고위험 4대 보고', '- 무엇을 바꾸나: 검사 설정 변경', '- 왜 필요한가: 병합 보호 강화', '- 승인 시 남는 위험: 설정 오류 가능', '- 미승인 시 영향: 보호 지연', `- 검증: https://github.com/${repo}/actions/runs/1`].join('\n')
const f = (filename, patch = '@@\n+x') => ({ filename, status: 'modified', patch })
const claudeOk = [{ user: { login: 'claude[bot]' }, body: `<!-- claude-fallback-review -->\nsha: ${sha}\nfindings: 0\n\n지적 없음`, created_at: '2026-11-15T10:05:00Z' }]
const leeOk = [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: sha, submitted_at: '2026-11-15T10:20:00Z' }]
const framePaths = ['src/pages/JobDetail.tsx']
const v = (o) => verdicts({ files: [f('src/a.ts')], reviews: [], reviewComments: [], comments: claudeOk, labels: [], deps: {}, sha, headDate, body: '', author: 'viecganban-bot', repo, framePaths, now: later, ...o })
assert.equal(CHECK_APPROVAL, 'approval-gate'); assert.ok(!('CHECK_REVIEW' in checks), 'ai-review 검사 이름 없음(11-21 지움)')
// ① 일반 PR: 승인 불필요 → approval-gate success. 판정 결과에 ai-review는 없다(11-21 지움)
{ const r = v({}); assert.equal('review' in r, false, 'ai-review 판정 없음'); assert.equal(r.approval.state, 'success'); assert.match(r.approval.summary, /Lee 승인 불필요/) }
// ② 고위험(검사 장치 변경): 승인·보고 전 차단 → 보고만 있으면 Lee 대기 → Lee Approve 뒤 통과
{ const files = [f('.github/workflows/x.yml')]
  assert.equal(v({ files }).approval.state, 'blocked', '본문 보고 없어도 Lee 승인 없음 → 대기(action_required) — 4대 보고 강제 폐지(11-21)'); assert.doesNotMatch(v({ files }).approval.summary, /4대 보고/)
  assert.equal(v({ files, body }).approval.state, 'blocked', 'Lee 승인 없음 → 대기(action_required)')
  assert.equal(v({ files, body, reviews: leeOk }).approval.state, 'success', 'Lee Approve → 통과')
  assert.equal(v({ files, body: '', reviews: leeOk }).approval.state, 'success', '보고 없이 Approve만 있어도 통과(11-21)')
  assert.equal(v({ files, body, reviews: [{ ...leeOk[0], commit_id: 'c'.repeat(40) }] }).approval.state, 'blocked', '옛 커밋 Approve → 대기')
  assert.equal(v({ files, body, reviews: [{ ...leeOk[0], user: { login: 'claude[bot]' } }] }).approval.state, 'blocked', '봇 Approve → 대기') }
// 판단 불가(새 최상위 폴더·patch 없음·파일 목록 비어 있음) = 고위험 취급
assert.equal(v({ files: [f('newdir/x.js')], body }).approval.state, 'blocked', '모르는 경로 → 대기')
assert.equal(v({ files: [{ filename: 'src/big.ts', status: 'modified' }], body }).approval.state, 'blocked', '코드 patch 없음 → 대기')
assert.equal(v({ files: [] }).approval.state, 'blocked', '파일 목록 비어 있음 → 판단 불가 → Lee 승인 대기(닫힌 실패)')
// 분석 오류도 닫힌 실패: 입력이 깨져도 success가 되지 않는다
assert.notEqual(verdicts({ files: null, reviews: [], reviewComments: [], comments: [], labels: [], sha, headDate, body, author: 'x', repo, framePaths }).approval?.state, 'success')
// 워크플로가 PR 코드를 받거나 실행하지 않음, 필요한 권한만
const yml = readFileSync(new URL('../../.github/workflows/approval-checks.yml', import.meta.url), 'utf8')
assert.match(yml, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/, '기본 브랜치(master)만 받음')
assert.ok(!/head\.sha|head\.ref|pull\/\$\{\{/.test(yml.replace(/^#.*$/gm, '')), 'PR 커밋을 체크아웃하지 않음')
{ const perms = yml.match(/^permissions:\n((?:  .*\n)+)/m)?.[1] ?? ''
  assert.ok(perms && !/write/.test(perms), '워크플로 기본 토큰은 읽기만(검사 결과는 검사 전용 앱 토큰으로)')
  assert.ok(!/id-token/.test(perms), 'OIDC 교환 안 씀(Claude 앱 토큰 교환은 checks 발급 불가)')
  const live = yml.replace(/^\s*#.*$/gm, '')
  assert.match(live, /^    environment: ops-keys$/m, '앱 열쇠는 기존 운영 열쇠 환경(ops-keys, master만)에서만')
  assert.deepEqual(live.match(/permission-[a-z-]+: \w+/g), ['permission-checks: write'], '검사 전용 앱 토큰은 Checks 쓰기 하나만 요청') }
console.log('approval-checks 시험 통과(일반·고위험·판단 불가·Lee 승인, ai-review 없음)')
// 검토 지적: PR 브랜치 사본이 도는 pull_request_review 트리거는 두지 않는다(주석 제외한 실제 트리거만 본다). Lee 승인 직후 재검사는 review-signal.yml → workflow_run 한 경로(검토관 지적 62aa013: 봇의 중복 수동 실행 단계는 지움).
{ const live = yml.replace(/^\s*#.*$/gm, '')
  assert.ok(!/pull_request_review/.test(live), 'approval-checks.yml에 pull_request_review 트리거 없음')
  assert.match(live, /pull_request_target:/); assert.match(live, /workflow_dispatch:/); assert.match(live, /schedule:/)
  const bot = readFileSync(new URL('../../.github/workflows/bot-pr-automerge.yml', import.meta.url), 'utf8')
  assert.ok(!/gh workflow run approval-checks\.yml/.test(bot.replace(/^\s*#.*$/gm, '')), '봇은 병합 조건 검사를 따로 부르지 않음(즉시 재검사는 review-signal 한 경로)') }
console.log('approval-checks 워크플로 트리거 시험 통과')
// 검토관 지적(bcf87e7): 예약 5분·문서에 켜는 순서(봇/수동 검토관 요청)와 승인 철회 창을 적어 고정
{ const live = yml.replace(/^\s*#.*$/gm, ''); assert.match(live, /cron: '\*\/5 \* \* \* \*'/, '예약 5분')
  const doc = readFileSync(new URL('../../docs/ops/2026-11-15_s4_merge_gate_settings.md', import.meta.url), 'utf8')
  assert.match(doc, /순서 주의[\s\S]*봇이 꺼진 동안[\s\S]*영원히 대기/, '필수 지정 전 검토관 요청 경로(봇 켜기 또는 수동 실행) 명시')
  assert.match(doc, /승인 철회 뒤에도 success가 남는 창/, '철회 창 명시')
  assert.ok(!/15분 예약|봇이 켜져 있을 때만 돈다/.test(doc), '문서가 현재 구조(review-signal 즉시 재검사·5분 예약 보조)와 맞음') }
console.log('approval-checks 문서·예약 시험 통과')
// S4 승인 취소 즉시 재검사: 신호 워크플로(권한 없음)가 끝나면 master 사본 workflow_run으로 approval-checks가 깨어난다
{ const sig = readFileSync(new URL('../../.github/workflows/review-signal.yml', import.meta.url), 'utf8').replace(/^\s*#.*$/gm, '')
  assert.match(sig, /pull_request_review:\s*\n\s*types: \[submitted, edited, dismissed\]/, '승인 제출·수정·취소 모두 신호')
  assert.match(sig, /permissions: \{\}/, '신호 워크플로는 권한 없음'); assert.ok(!/checkout|secrets\.|id-token|GITHUB_TOKEN/.test(sig), '신호 워크플로는 코드 받기·비밀값·토큰 없음')
  const name = readFileSync(new URL('../../.github/workflows/review-signal.yml', import.meta.url), 'utf8').match(/^name: (.+)$/m)[1].trim()
  const live = yml.replace(/^\s*#.*$/gm, '')
  assert.ok(live.includes(`workflows: ['${name}']`), 'approval-checks가 신호 워크플로 이름으로 workflow_run 대기'); assert.match(live, /workflow_run:[\s\S]*types: \[completed\]/)
  assert.ok(!/pull_request_review/.test(live), 'approval-checks.yml 자체에는 pull_request_review 없음(master 사본만 도는 트리거)') }
console.log('approval-checks 승인 취소 신호 시험 통과')

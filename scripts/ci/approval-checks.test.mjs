// S4 8단계 시험: ai-review·approval-gate 판정(순수 함수) — 일반 통과 / 고위험·판단 불가 차단 / 4대 보고·Lee 승인 / 검토 미완료
import assert from 'node:assert/strict'
import { verdicts, CHECK_REVIEW, CHECK_APPROVAL } from './approval-checks.mjs'
import { readFileSync } from 'node:fs'
const sha = 'a'.repeat(40), repo = 'KHOAILANG0926/jobi-app'
const headDate = '2026-11-15T10:00:00Z', later = new Date('2026-11-15T10:30:00Z')
const body = ['## 고위험 4대 보고', '- 무엇을 바꾸나: 검사 설정 변경', '- 왜 필요한가: 병합 보호 강화', '- 승인 시 남는 위험: 설정 오류 가능', '- 미승인 시 영향: 보호 지연', `- 검증: https://github.com/${repo}/actions/runs/1`].join('\n')
const f = (filename, patch = '@@\n+x') => ({ filename, status: 'modified', patch })
const claudeOk = [{ user: { login: 'claude[bot]' }, body: `<!-- claude-fallback-review -->\nsha: ${sha}\nfindings: 0\n\n지적 없음`, created_at: '2026-11-15T10:05:00Z' }]
const leeOk = [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: sha, submitted_at: '2026-11-15T10:20:00Z' }]
const framePaths = ['src/pages/JobDetail.tsx']
const v = (o) => verdicts({ files: [f('src/a.ts')], reviews: [], reviewComments: [], comments: claudeOk, labels: [], deps: {}, sha, headDate, body: '', author: 'viecganban-bot', repo, framePaths, now: later, ...o })
assert.equal(CHECK_REVIEW, 'ai-review'); assert.equal(CHECK_APPROVAL, 'approval-gate')
// ① 일반 PR: 검토 통과 + 승인 불필요 → 둘 다 success(Lee 개입 없음)
{ const r = v({}); assert.equal(r.review.state, 'success'); assert.equal(r.approval.state, 'success'); assert.match(r.approval.summary, /Lee 승인 불필요/) }
// 독립 검토 미완료(검토관 결과 없음·요청 전) → pending(필수 검사가 통과하지 않음)
assert.equal(v({ comments: [] }).review.state, 'pending', '검토 결과 없음 → 대기')
// 검토관 지적에 답 없음 → pending
{ const c = [{ user: { login: 'claude[bot]' }, body: `<!-- claude-fallback-review -->\nsha: ${sha}\nfindings: 2\n\nx`, created_at: '2026-11-15T10:05:00Z' }]; assert.equal(v({ comments: c }).review.state, 'pending', '지적에 답 없음 → 대기') }
// 다른 커밋의 검토 결과는 인정 안 함
assert.equal(v({ comments: [{ ...claudeOk[0], body: claudeOk[0].body.replace(sha, 'b'.repeat(40)) }] }).review.state, 'pending', '옛 커밋 검토는 무효')
// AI가 아닌 계정이 단 검토 결과 흉내는 인정 안 함
assert.equal(v({ comments: [{ ...claudeOk[0], user: { login: 'someone' } }] }).review.state, 'pending', '다른 계정의 표시 댓글 무효')
// ② 고위험(검사 장치 변경): 승인·보고 전 차단 → 보고만 있으면 Lee 대기 → Lee Approve 뒤 통과
{ const files = [f('.github/workflows/x.yml')]
  assert.equal(v({ files }).approval.state, 'failure', '보고 없음 → 실패'); assert.match(v({ files }).approval.summary, /4대 보고/)
  assert.equal(v({ files, body }).approval.state, 'blocked', '보고 있음·Lee 승인 없음 → 대기(action_required)')
  assert.equal(v({ files, body, reviews: leeOk }).approval.state, 'success', '보고 + Lee Approve → 통과')
  assert.equal(v({ files, body: '', reviews: leeOk }).approval.state, 'failure', 'Approve만 있고 보고 없음 → 실패')
  assert.equal(v({ files, body, reviews: [{ ...leeOk[0], commit_id: 'c'.repeat(40) }] }).approval.state, 'blocked', '옛 커밋 Approve → 대기')
  assert.equal(v({ files, body, reviews: [{ ...leeOk[0], user: { login: 'claude[bot]' } }] }).approval.state, 'blocked', '봇 Approve → 대기') }
// 판단 불가(새 최상위 폴더·patch 없음·파일 목록 비어 있음) = 고위험 취급
assert.equal(v({ files: [f('newdir/x.js')], body }).approval.state, 'blocked', '모르는 경로 → 대기')
assert.equal(v({ files: [{ filename: 'src/big.ts', status: 'modified' }], body }).approval.state, 'blocked', '코드 patch 없음 → 대기')
assert.equal(v({ files: [] }).approval.state, 'failure', '파일 목록 비어 있음 → 보고 없음 실패')
// 분석 오류도 닫힌 실패: 입력이 깨져도 success가 되지 않는다
assert.notEqual(verdicts({ files: null, reviews: [], reviewComments: [], comments: [], labels: [], sha, headDate, body, author: 'x', repo, framePaths }).approval?.state, 'success')
// 워크플로가 PR 코드를 받거나 실행하지 않음, 필요한 권한만
const yml = readFileSync(new URL('../../.github/workflows/approval-checks.yml', import.meta.url), 'utf8')
assert.match(yml, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/, '기본 브랜치(master)만 받음')
assert.ok(!/head\.sha|head\.ref|pull\/\$\{\{/.test(yml.replace(/^#.*$/gm, '')), 'PR 커밋을 체크아웃하지 않음')
assert.ok(!/contents: write|checks: write|pull-requests: write/.test(yml), '쓰기 권한 없음(검사 결과는 Claude 앱 토큰으로)')
console.log('approval-checks 시험 통과(일반·고위험·판단 불가·검토 미완료·보고·Lee 승인)')

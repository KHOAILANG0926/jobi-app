// #1004 운영 검사 알림(scripts/ci/deploy-notify.sh) 시험 — gh를 대역으로 두고 발송 여부·중복 방지·멘션 범위·닫힌 방향을 본다.
// 실제 GitHub 발송·Lee 단말 수신은 이 시험이 보증하지 않는다(실제 실행 ID 근거는 PR 본문에 따로).
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const REPO = 'o/r'
function run(mode, fx = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dn-'))
  const w = (name, data) => writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data))
  w('pulls.json', fx.pulls ?? [{ number: 7, merged_at: '2026-11-24T00:00:00Z' }])
  w('comments.json', [fx.comments ?? []])          // --paginate --slurp 모양: 쪽마다 배열
  w('issues.json', [fx.issues ?? []])
  w('jobs.json', fx.jobs ?? { jobs: [{ steps: [{ name: 'ok', conclusion: 'success' }, { name: '지도 요약·m 입력', conclusion: 'failure' }] }] })
  const stub = `#!/usr/bin/env bash
a="$*"; printf '%s\n' "\${a//$'\n'/ ⏎ }" >> "$LOG"
fail() { [ -n "$FAIL_ON" ] && case "$*" in *"$FAIL_ON"*) exit 1;; esac; }
fail "$*"
case "$*" in
  "issue create"*) echo created ;;
  *"-X POST"*"/comments"*) echo '{}' ;;
  *"/commits/"*"/pulls"*) cat "$FX/pulls.json" ;;
  *"/issues/"*"/comments"*) cat "$FX/comments.json" ;;
  *"/actions/runs/"*"/jobs"*) cat "$FX/jobs.json" ;;
  *"/issues?state=open"*) cat "$FX/issues.json" ;;
esac
`
  writeFileSync(join(dir, 'gh'), stub); chmodSync(join(dir, 'gh'), 0o755)
  const log = join(dir, 'calls.log'); writeFileSync(log, '')
  const r = spawnSync('bash', [join(process.cwd(), 'scripts/ci/deploy-notify.sh'), mode], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FX: dir, LOG: log, REPO, SHA, RUN_ID: '999', GITHUB_SERVER_URL: 'https://github.com', FAIL_ON: fx.failOn ?? '' },
  })
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean)
  const body = existsSync(join(dir, 'body.md')) ? readFileSync(join(dir, 'body.md'), 'utf8') : ''
  return { r, calls, body, posts: calls.filter((c) => c.includes('-X POST')), creates: calls.filter((c) => c.startsWith('issue create')) }
}
const bot = (body) => ({ user: { login: 'github-actions[bot]' }, body })

// ── success
{ const o = run('success', { comments: [bot('<!-- decision-approval-request -->\nLee 승인 필요')] })
  assert.equal(o.r.status, 0)
  assert.equal(o.posts.length, 1, '승인을 요청했던 PR에 완료 댓글 1번')
  assert.match(o.posts[0], /deploy-verify-done:a1b2c3d4e5f6/, '같은 커밋 표시가 첫머리')
  assert.match(o.posts[0], /@o ✅ 완료/, '승인을 요청했던 PR은 Lee 멘션')
  assert.match(o.posts[0], /actions\/runs\/999/, '확인 실행 링크') }
{ const o = run('success', { comments: [bot('<!-- decision-approval-request -->\nx'), bot(`<!-- deploy-verify-done:${SHA} -->\n✅ 완료`)] })
  assert.equal(o.posts.length, 0, '같은 커밋 완료 표시가 있으면 다시 남기지 않음(재실행·중복 방지)') }
{ const o = run('success', { comments: [] })
  assert.equal(o.posts.length, 1)
  assert.ok(!/@o /.test(o.posts[0]), 'Lee 승인 요청이 없던 자동 병합 PR은 멘션 없음(정상 진행 중 알림 없음)') }
{ const o = run('success', { comments: [{ user: { login: 'someone' }, body: '<!-- decision-approval-request -->' }] })
  assert.ok(!/@o /.test(o.posts[0]), '다른 사람이 쓴 요청 표시로 멘션을 유도할 수 없음(봇 댓글만 인정)') }
{ const o = run('success', { pulls: [] })
  assert.equal(o.r.status, 0); assert.equal(o.posts.length, 0, 'PR 없는 직접 반영은 알림 생략') }
{ const o = run('success', { pulls: [{ number: 3, merged_at: null }] })
  assert.equal(o.posts.length, 0, '병합 안 된 PR은 대상 아님') }
{ const o = run('success', { failOn: '-X POST' })
  assert.equal(o.r.status, 0, '알림 발송 실패는 운영 검사 결과를 바꾸지 않음'); assert.match(o.r.stdout, /::warning::/, '실패는 경고로 보임') }
{ const o = run('success', { failOn: '/issues/7/comments?per_page' })
  assert.equal(o.posts.length, 0, '중복 확인을 못 하면 보내지 않음(같은 알림 반복 방지)'); assert.equal(o.r.status, 0) }

// ── failure
{ const o = run('failure')
  assert.equal(o.r.status, 0)
  assert.equal(o.creates.length, 1, '열린 이슈가 없으면 만든다')
  assert.match(o.creates[0], /--title 운영 배포 검증 실패: a1b2c3d/, '제목 형식 유지(S6 병합 잠금이 읽음)')
  assert.match(o.body, new RegExp(`^커밋 ${SHA} 의 운영 배포 확인`), '본문 첫 줄 형식 유지')
  assert.match(o.body, /@o 조치 필요 — 실패 단계: 지도 요약·m 입력/, 'Lee 멘션 + 실패 단계')
  assert.match(o.body, /actions\/runs\/999/, '실행 기록 링크')
  assert.match(o.body, /필요한 조치:.*Re-run failed jobs.*rollback.*Lee 승인/s, '필요한 조치') }
{ const o = run('failure', { issues: [{ number: 41, title: `운영 배포 검증 실패: ${SHA.slice(0, 7)}` }] })
  assert.equal(o.creates.length, 0, '같은 제목의 열린 이슈가 있으면 새로 만들지 않음(중복 알림 방지)') }
{ const o = run('failure', { issues: [{ number: 41, title: '운영 배포 검증 실패: ffffff0' }, { number: 42, pull_request: {}, title: `운영 배포 검증 실패: ${SHA.slice(0, 7)}` }] })
  assert.equal(o.creates.length, 1, '다른 커밋 이슈·PR은 중복으로 보지 않음') }
{ const o = run('failure', { failOn: '/issues?state=open' })
  assert.equal(o.creates.length, 1, '이슈 조회 실패여도 알림 누락을 피해 만든다(닫힌 방향의 반대 — 장애 알림은 누락 금지)') }
{ const o = run('failure', { jobs: { jobs: [] } })
  assert.match(o.body, /실패 단계: 확인하지 못함/, '실패 단계를 모르면 모른다고 적는다') }
{ const o = run('failure', { failOn: 'issue create' })
  assert.equal(o.r.status, 0); assert.match(o.r.stdout, /::error::/, '이슈 생성 실패는 오류로 보임') }
{ const o = run('weird'); assert.equal(o.r.status, 2, '모르는 모드는 실패') }
// 실제 발송 확인(#1004, 실행 45377084519): issues: write만으로는 PR 댓글이 403이었다 — 완료 댓글을 쓰는 워크플로에는 pull-requests: write가 있어야 한다(gh 대역 시험은 권한을 못 본다)
{ const wf = readFileSync(join(process.cwd(), '.github/workflows/deploy-verify.yml'), 'utf8')
  assert.match(wf, /^permissions:[\s\S]*?^  pull-requests: write/m, 'deploy-verify.yml 권한에 pull-requests: write')
  assert.match(wf, /deploy-notify\.sh success/, '완료 댓글 단계가 이 워크플로에 있음') }

// ── 운영 검사 성공 + 열린 잠금 이슈: 판정 재계산·6분 뒤 봇 재확인을 기존 장치로 호출(2026-11-26)
const lockIssue = (n, sha) => ({ number: n, title: `운영 배포 검증 실패: ${sha}`, user: { login: 'github-actions[bot]' } })
{ const o = run('success', { issues: [lockIssue(11, 'abc1234'), lockIssue(12, 'def5678'), { number: 13, title: '다른 이슈', user: { login: 'github-actions[bot]' } }] })
  assert.equal(o.r.status, 0)
  assert.ok(o.calls.some((c) => /^workflow run approval-checks\.yml/.test(c)), '잠금 이슈가 열려 있으면 approval-checks 재판정 호출')
  assert.ok(o.calls.some((c) => /^workflow run codex-wait-timer\.yml.*-f minutes=6/.test(c)), '기존 다시 확인 타이머 6분')
  assert.match(o.r.stdout, /잠금 이슈 2건/, '두 건만 센다') }
{ const o = run('success', { issues: [] })
  assert.equal(o.calls.filter((c) => c.startsWith('workflow run')).length, 0, '잠금 이슈가 없으면 호출하지 않음(성공마다 부르지 않음)') }
{ const o = run('success', { issues: [lockIssue(11, 'abc1234')], failOn: 'workflow run' })
  assert.equal(o.r.status, 0, '호출 실패는 경고만 — 알림·운영 검사 결과는 그대로')
  assert.match(o.r.stdout + o.r.stderr, /잠금 해제 반영 호출 실패/) }
{ const o = run('success', { issues: [{ ...lockIssue(11, 'abc1234'), user: { login: 'someone' } }] })
  assert.equal(o.calls.filter((c) => c.startsWith('workflow run')).length, 0, '작성자가 github-actions[bot]이 아닌 이슈는 잠금이 아님(남이 같은 제목으로 열어도 호출을 못 만듦)') }

console.log('deploy-notify.test.mjs: 통과')

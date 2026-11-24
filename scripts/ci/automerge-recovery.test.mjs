// 자동 병합 실패 복구 + 운영 검사 성공 뒤 다음 작업 1건 착수(Lee 2026-11-24 1순위) 시험.
// 실제 워크플로 YAML에서 쉘을 꺼내 가짜 gh로 돌린다(네트워크·열쇠 없음). 수정 전(master 사본)은 실패를 재현하고, 수정 후는 통과해야 한다.
// 사용: node scripts/ci/automerge-recovery.test.mjs  (수정 전 재현까지: AMR_BEFORE_REF=<수정 전 커밋>, 기준 시각 조회 실패 사례는 AMR_BEFORE_FALLBACK_REF=41fb3f8 — 그 커밋의 워크플로로 같은 사례가 실패하는지 확인. CI는 수정 후 시험만)
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const REPO = 'o/r'
const yaml = (text) => JSON.parse(execFileSync('python3', ['-c', 'import sys,json,yaml;w=yaml.safe_load(sys.stdin.read());w["on"]=w.get("on",w.get(True));w.pop(True,None);print(json.dumps(w))'], { input: text, encoding: 'utf8' }))
const wf = (name, ref) => yaml(ref ? execFileSync('git', ['-C', ROOT, 'show', `${ref}:.github/workflows/${name}.yml`], { encoding: 'utf8' }) : readFileSync(join(ROOT, `.github/workflows/${name}.yml`), 'utf8'))
const step = (w, job, name) => { const s = w.jobs[job].steps.find((x) => x.name === name); assert.ok(s, `${job}: 단계 '${name}' 없음`); return s }
const jq = (args, input) => execFileSync('jq', args, { input, encoding: 'utf8' })

// 가짜 gh: 요청 경로별로 고정 자료를 돌려주고, 쓰기(댓글·라벨·병합·워크플로 호출)는 기록만 한다. --paginate --slurp는 페이지 배열, --jq는 실제 jq로 적용.
const FAKE = String.raw`#!/usr/bin/env node
const fs = require('fs'), { execFileSync } = require('child_process')
const dir = process.env.FAKE_DIR, fx = JSON.parse(fs.readFileSync(dir + '/fx.json', 'utf8'))
const st = fs.existsSync(dir + '/state.json') ? JSON.parse(fs.readFileSync(dir + '/state.json', 'utf8')) : { comments: {}, labels: {} }
const save = () => fs.writeFileSync(dir + '/state.json', JSON.stringify(st))
const log = (l) => fs.appendFileSync(dir + '/calls.log', l + '\n')
const a = process.argv.slice(2)
const out = (v, q) => { let s = typeof v === 'string' ? v : JSON.stringify(v); if (q) s = execFileSync('jq', ['-r', q], { input: s, encoding: 'utf8' }).replace(/\n$/, ''); if (s !== '') process.stdout.write(s + '\n') }
if (a[0] === 'workflow' && a[1] === 'run') { log(('workflow run ' + a.slice(2).join(' ')).replace(/\n/g, ' ')); process.exit(fx.failDispatch ? 1 : 0) }
if (a[0] === 'pr' && a[1] === 'list') { const q = a[a.indexOf('--jq') + 1]; out(fx.prs, q); process.exit(0) }
if (a[0] !== 'api') { log('unknown ' + a.join(' ')); process.exit(1) }
let method = 'GET', path = '', q = '', slurp = false, raw = false; const fields = {}
for (let i = 1; i < a.length; i++) {
  const k = a[i]
  if (k === '-X') method = a[++i]; else if (k === '-f') { const [kk, ...v] = a[++i].split('='); fields[kk] = v.join('=') }
  else if (k === '-H') { raw = /raw/.test(a[++i]) } else if (k === '--jq') q = a[++i]; else if (k === '--slurp') slurp = true; else if (k === '--paginate') {} else path = k
}
const p = path.split('?')[0], m = (re) => p.match(re)
const fail = () => { log('FAIL ' + method + ' ' + path); process.exit(1) }
if ((fx.failPaths || []).some((x) => path.includes(x))) fail()
let v, r
if ((r = m(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments$/))) {
  const n = r[1]; st.comments[n] ??= (fx.comments?.[n] ?? [])
  if (method === 'POST') { st.comments[n].push({ user: { login: 'github-actions[bot]' }, body: fields.body }); save(); log('comment #' + n + ' ' + fields.body.split('\n')[0]); out({}); process.exit(0) }
  v = st.comments[n]
} else if ((r = m(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/labels(?:\/(.+))?$/))) {
  const n = r[1]; st.labels[n] ??= []
  if (method === 'POST') st.labels[n].push(fields['labels[]']); else if (method === 'DELETE') st.labels[n] = st.labels[n].filter((x) => x !== decodeURIComponent(r[2]))
  save(); log('label ' + method + ' #' + n + ' ' + (fields['labels[]'] || r[2])); out({}); process.exit(0)
} else if ((r = m(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)$/))) {
  const it = (fx.issues || []).find((x) => String(x.number) === r[1]) || { number: Number(r[1]), labels: [] }
  v = { ...it, labels: [...it.labels, ...((st.labels[r[1]] || []).map((name) => ({ name })))] }
} else if (m(/^repos\/[^/]+\/[^/]+\/issues$/)) {
  v = (fx.issues || []).map((it) => ({ ...it, labels: [...it.labels, ...((st.labels[it.number] || []).map((name) => ({ name })))] }))
} else if ((r = m(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)\/files$/))) v = fx.pr[r[1]].files
else if ((r = m(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)\/reviews$/))) v = fx.pr[r[1]].reviews || []
else if ((r = m(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)\/comments$/))) v = fx.pr[r[1]].reviewComments || []
else if ((r = m(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/reactions$/))) v = (fx.reactions || {})[r[1]] || []
else if ((r = m(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/events$/))) v = (fx.events || {})[r[1]] || []
else if ((r = m(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)\/merge$/))) { log('MERGE #' + r[1]); out({ merged: true }); process.exit(0) }
else if ((r = m(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)$/))) { const x = fx.pr[r[1]]; v = { body: x.body || '', title: 'T', draft: false, created_at: x.createdAt, mergeable_state: 'clean', head: { sha: x.sha }, base: { sha: 'b'.repeat(40) } } }
else if ((r = m(/^repos\/[^/]+\/[^/]+\/commits\/([^/]+)\/check-runs$/))) v = { total_count: fx.checks.length, check_runs: fx.checks }
else if ((r = m(/^repos\/[^/]+\/[^/]+\/commits\/master$/))) v = { sha: fx.masterHead }
else if ((r = m(/^repos\/[^/]+\/[^/]+\/commits\/([^/]+)$/))) v = { sha: r[1], commit: { committer: { date: fx.headDate } } }
else if (m(/^repos\/[^/]+\/[^/]+\/actions\/workflows\/deploy-verify\.yml\/runs$/)) v = { workflow_runs: fx.dvRuns || [] }
else { log('unrouted ' + method + ' ' + path); process.exit(1) }
out(slurp ? [v] : v, q)
`

function sandbox(fx) {
  const dir = mkdtempSync(join(tmpdir(), 'amr-'))
  writeFileSync(join(dir, 'gh'), FAKE); chmodSync(join(dir, 'gh'), 0o755)
  writeFileSync(join(dir, 'fx.json'), JSON.stringify(fx)); writeFileSync(join(dir, 'calls.log'), ''); writeFileSync(join(dir, 'summary.md'), '')
  return dir
}
function runShell(script, dir, env = {}) {
  const work = mkdtempSync(join(tmpdir(), 'amr-work-'))
  const r = spawnSync('bash', ['-c', `cd "${work}" && ln -s "${ROOT}/scripts" scripts && ln -s "${ROOT}/.github" .github && bash "${dir}/run.sh"`], {
    encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir, GH_TOKEN: 'x', GITHUB_TOKEN: 'x', REPO, GITHUB_STEP_SUMMARY: join(dir, 'summary.md'), ...env },
    input: '', timeout: 60000,
  })
  return { ...r, calls: readFileSync(join(dir, 'calls.log'), 'utf8'), summary: readFileSync(join(dir, 'summary.md'), 'utf8') }
}
const exec = (script, fx, env) => { const dir = sandbox(fx); writeFileSync(join(dir, 'run.sh'), script); return { dir, ...runShell(script, dir, env) } }

const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString().replace(/\.\d+Z$/, 'Z')
const SHA = 'c'.repeat(40)
const green = ['checks', 'app-screen', 'guard', 'publication-gate'].map((name, i) => ({ id: i + 1, name, status: 'completed', conclusion: 'success', started_at: iso(30), check_suite: { id: i + 1 }, app: { slug: 'github-actions' } }))
const prRow = (number, cross) => ({ number, headRefName: 'b', headRefOid: SHA, baseRefName: 'master', isDraft: false, title: 'T', author: { login: 'viecganban-bot' }, isCrossRepository: cross })
const prData = { sha: SHA, files: [{ filename: 'src/lib/x.ts', status: 'modified', patch: '+a' }], reviews: [], body: '본문' }
const BOT_STEP = 'GitHub Actions bot 인증으로 안전 병합'
const botNew = step(wf('bot-pr-automerge'), 'merge', BOT_STEP).run
const BEFORE = process.env.AMR_BEFORE_REF
const botOld = BEFORE ? step(wf('bot-pr-automerge', BEFORE), 'merge', BOT_STEP).run : null
// 기준 시각 조회 실패 사례는 #995 병합본(41fb3f8)부터 있는 코드라, 수정 전 재현은 AMR_BEFORE_FALLBACK_REF(예: 41fb3f8)로 따로 준다
const BEFORE_FALLBACK = process.env.AMR_BEFORE_FALLBACK_REF ? step(wf('bot-pr-automerge', process.env.AMR_BEFORE_FALLBACK_REF), 'merge', BOT_STEP).run : null

// ── 1. approval-gate가 오지 않는 PR(포크 #955 사례) — 수정 전: 6분 재확인을 무기한 예약 / 수정 후: 재확인 없음 + 사유 기록 1번
{
  const fx = { prs: [prRow(955, true)], pr: { 955: prData }, checks: green, headDate: iso(60 * 48) }
  if (botOld) { const before = exec(botOld, fx)
  assert.equal(before.status, 0, before.stderr)
  assert.match(before.calls, /workflow run codex-wait-timer\.yml .*minutes=6/, '수정 전 재현: approval-gate 없는 포크 PR에 6분 재확인 예약(무한 반복의 원인)'); console.log(`  수정 전(${BEFORE}) 재현: 포크 PR 6분 재확인 예약됨`) }
  const after = exec(botNew, fx)
  assert.equal(after.status, 0, after.stderr)
  assert.doesNotMatch(after.calls, /codex-wait-timer/, '수정 후: 포크 PR은 재확인 예약 없음')
  assert.doesNotMatch(after.calls, /MERGE/, '병합 없음')
  assert.match(after.calls, /comment #955 <!-- bot-merge-block:fork:ccccccc -->/, '수정 후: PR에 차단 사유 기록')
  assert.match(after.summary, /PR #955 병합 보류\(재확인 안 함\): 포크/, '수정 후: Actions 요약에 차단 사유 기록')
  // 같은 커밋 재실행(중복 이벤트) → 댓글은 다시 달지 않는다
  writeFileSync(join(after.dir, 'calls.log'), '')
  const again = runShell(botNew, after.dir)
  assert.doesNotMatch(again.calls, /comment #955/, '같은 커밋·같은 사유 댓글은 한 번만')
  console.log('1 포크 PR(approval-gate 없음): 수정 전 무한 재확인 재현 → 수정 후 재확인 중단·사유 기록 1번 통과')
}

// ── 2. 같은 저장소 PR인데 approval-gate가 판정 중(pending) — 60분 안이면 6분 재확인(일시), 넘으면 재확인 중단·대표 판단
{
  const fresh = { prs: [prRow(996, false)], pr: { 996: prData }, checks: green, headDate: iso(10) }
  const a = exec(botNew, fresh)
  assert.equal(a.status, 0, a.stderr)
  assert.match(a.calls, /workflow run codex-wait-timer\.yml .*minutes=6/, '60분 안: 6분 뒤 재확인(일시적 지연 자동 복구 경로 유지)')
  assert.doesNotMatch(a.calls, /comment #996/, '60분 안: 차단 기록 없음')
  const stale = { ...fresh, headDate: iso(180) }
  if (botOld) { const beforeStale = exec(botOld, stale)
  assert.match(beforeStale.calls, /codex-wait-timer\.yml .*minutes=6/, '수정 전 재현: 3시간 지나도 계속 재확인 예약(상한 없음)'); console.log(`  수정 전(${BEFORE}) 재현: 3시간 지난 판정 대기도 계속 재확인`) }
  const b = exec(botNew, stale)
  assert.doesNotMatch(b.calls, /codex-wait-timer/, '60분 초과: 재확인 중단')
  assert.doesNotMatch(b.calls, /MERGE/, '60분 초과: 자동 병합 없음')
  assert.match(b.calls, /comment #996 <!-- bot-merge-block:gate-timeout:/, '60분 초과: 판정 불가 — 대표 판단 기록')
  // 오래된 커밋이라도 Lee가 방금 이 커밋에 Approve했으면 반영 지연(몇 분)은 기다린다(#920·#925 수정 유지)
  const approvedNow = { ...stale, pr: { 996: { ...prData, reviews: [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: SHA, submitted_at: iso(2) }] } } }
  const c = exec(botNew, approvedNow)
  assert.match(c.calls, /codex-wait-timer\.yml .*minutes=6/, '방금 승인: 6분 재확인 유지')
  // 실행 45293080396 재현: 판정 파일(recheck-since.jq)을 못 읽으면(PR 브랜치 워크플로 + master scripts) 기준 시각이 비었다 → 방금 승인한 PR을 '60분 초과 판정 불가'로 보류함
  //   수정 후: 조회 실패는 head 커밋 시각으로 대신(이 사례는 head 2분 → 재확인), 그것도 없으면 재확인(판정 불가로 보지 않음). 승인 판정·approval-gate 확인은 그대로.
  const noFile = (script) => script.replaceAll('scripts/ci/recheck-since.jq', 'scripts/ci/__missing__.jq')
  const justApproved = { ...fresh, headDate: iso(2), pr: { 996: { ...prData, reviews: [{ user: { login: 'KHOAILANG0926' }, state: 'APPROVED', commit_id: SHA, submitted_at: iso(1) }] } } }
  if (BEFORE_FALLBACK) { const old = exec(noFile(BEFORE_FALLBACK), justApproved)
    assert.match(old.calls, /comment #996 <!-- bot-merge-block:gate-timeout:/, '수정 전 재현: 판정 파일 없음 → 방금 승인한 PR을 판정 불가로 보류')
    assert.doesNotMatch(old.calls, /codex-wait-timer/); console.log(`  수정 전(${process.env.AMR_BEFORE_FALLBACK_REF}) 재현: 판정 파일 없음 → 방금 승인 PR 판정 불가 보류`) }
  const d = exec(noFile(botNew), justApproved)
  assert.match(d.calls, /codex-wait-timer\.yml .*minutes=6/, '판정 파일 없음 → head 시각으로 대신해 6분 재확인')
  assert.doesNotMatch(d.calls, /comment #996/, '판정 파일 없음 → 판정 불가 보류 안 함')
  const e = exec(noFile(botNew), { ...justApproved, headDate: '' })
  assert.match(e.calls, /codex-wait-timer\.yml .*minutes=6/, '기준 시각 전혀 없음 → 조회 실패로 재확인')
  assert.doesNotMatch(e.calls, /comment #996|MERGE/, '기준 시각 없음 → 보류 기록·병합 없음(approval-gate pending)')
  const f = exec(noFile(botNew), { ...stale })
  assert.match(f.calls, /comment #996 <!-- bot-merge-block:gate-timeout:/, '판정 파일 없어도 head 3시간 → 60분 상한 그대로')
  console.log('2 approval-gate 대기: 60분 안 재확인·60분 초과 중단(대표 판단)·방금 승인 재확인·기준 시각 조회 실패는 재확인 통과')
}

// ── 3. 병합 거절 사유 분류(영구는 재시도 안 함) — 판정 파일 단위 시험은 bot-required-checks.test.mjs, 여기서는 재확인 기준 시각 파일
{
  const since = (reviews, head) => jq(['-r', '--arg', 'sha', SHA, '--arg', 'head', head, '-f', 'scripts/ci/recheck-since.jq'], JSON.stringify(reviews)).trim()
  assert.equal(since([], '2026-11-20T00:00:00Z'), '2026-11-20T00:00:00Z', '리뷰 없음 → head 시각')
  assert.equal(since([{ commit_id: SHA, submitted_at: '2026-11-23T05:00:00Z' }], '2026-11-20T00:00:00Z'), '2026-11-23T05:00:00Z', '이 커밋 리뷰가 늦으면 리뷰 시각')
  assert.equal(since([{ commit_id: 'd'.repeat(40), submitted_at: '2026-11-23T05:00:00Z' }], '2026-11-20T00:00:00Z'), '2026-11-20T00:00:00Z', '다른 커밋 리뷰는 무시')
  assert.equal(since([], ''), '', '둘 다 없으면 빈 값 → 재확인 예약 안 함(닫힌 방향)')
  console.log('3 재확인 기준 시각(recheck-since.jq) 통과')
}

// ── 4. 운영 검사 성공 뒤 다음 작업 연결(deploy-verify → task-pickup)
const dv = wf('deploy-verify')
const PICK_STEP = '운영 검사 성공 뒤 다음 작업 1건 착수 (성공 1건당 최대 1번)'
{
  const steps = dv.jobs.verify.steps, i = steps.findIndex((s) => s.name === PICK_STEP)
  assert.ok(i > 0, 'deploy-verify에 다음 작업 연결 단계 있음')
  assert.match(String(steps[i].if), /^success\(\) && /, '운영 검사가 모두 성공했을 때만(실패면 돌지 않음 → 다음 작업 연결 차단)')
  for (const n of ['운영 주소 실제 화면 검사 (PC·모바일)', 'Vercel Production 배포 READY 확인 (이 커밋)', '지도 요약·m 입력·위쪽 검색 결과 운영 확인'])
    assert.ok(steps.findIndex((s) => s.name === n) < i, `운영 검사 '${n}' 뒤에 있어야 함`)
  assert.equal(dv.permissions.actions, 'write', '작업 큐 호출 권한')
  if (BEFORE) { assert.equal(execFileSync('git', ['-C', ROOT, 'show', `${BEFORE}:.github/workflows/deploy-verify.yml`], { encoding: 'utf8' }).includes('deploy-success-pickup'), false, '수정 전 재현: 운영 검사 성공 뒤 다음 작업을 부르는 길이 없었음'); console.log(`  수정 전(${BEFORE}) 재현: 운영 검사 성공 뒤 다음 작업 연결 없음`) }
}
const PICK = `bash scripts/ci/deploy-success-pickup.sh`
const pick = (fx, env) => exec(PICK, fx, { SHA, RUN_ID: '100', RUN_ATTEMPT: '1', ...env })
{
  const ok = pick({ masterHead: SHA, dvRuns: [] })
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal((ok.calls.match(/workflow run claude-auto\.yml/g) || []).length, 1, '운영 성공 1건 → 작업 큐 정확히 1번 호출')
  assert.match(ok.calls, /-f pickup=true/)
  const rerun = pick({ masterHead: SHA, dvRuns: [] }, { RUN_ATTEMPT: '2' })
  assert.doesNotMatch(rerun.calls, /claude-auto/, '같은 실행 재실행 → 다시 부르지 않음')
  const dup = pick({ masterHead: SHA, dvRuns: [{ id: 99, head_sha: SHA, conclusion: 'success' }] })
  assert.doesNotMatch(dup.calls, /claude-auto/, '같은 커밋 이미 성공(다른 실행) → 다시 부르지 않음')
  const moved = pick({ masterHead: 'e'.repeat(40), dvRuns: [] })
  assert.doesNotMatch(moved.calls, /claude-auto/, 'master가 앞으로 감 → 뒤 커밋이 판단')
  const err = pick({ masterHead: SHA, dvRuns: [], failPaths: ['deploy-verify.yml/runs'] })
  assert.doesNotMatch(err.calls, /claude-auto/, '조회 실패 → 부르지 않음(닫힌 방향)')
  assert.equal(err.status, 0, '조회 실패해도 운영 검사 결과(성공)는 바꾸지 않음')
  console.log('4 운영 검사 성공 → 작업 큐 1번 호출, 재실행·중복·옛 커밋·조회 실패는 호출 안 함 통과')
}

// ── 5. 작업 큐(claude-auto task-pickup) — pickup 호출로 다음 이슈 정확히 1건, 진행 중·닫힌 이슈 중복 착수 없음, 결과는 Draft PR
{
  const ca = wf('claude-auto')
  const tp = ca.jobs['task-pickup']
  assert.match(tp.if, /github\.event_name == 'workflow_dispatch' && inputs\.pickup/, 'pickup 호출로 task-pickup 실행')
  assert.match(ca.jobs['claude-task'].if, /inputs\.task != ''/, 'pickup 호출만으로는 Claude 작업이 바로 돌지 않음(task-pickup이 이슈 글로 다시 부름)')
  const script = tp.steps[0].run
  const issue = (number, labels, extra = {}) => ({ number, title: `이슈 ${number}`, body: '지시', state: 'open', pull_request: null, user: { login: 'KHOAILANG0926' }, labels: labels.map((name) => ({ name })), ...extra })
  const fx = { issues: [issue(940, ['ai-team', 'ai-task', 'ai-task-running']), issue(950, ['ai-team', 'ai-task']), issue(960, ['ai-team', 'ai-task', 'needs-lee']), issue(930, ['ai-task'], { state: 'closed' })] }
  const env = { OWNER: 'KHOAILANG0926', EVENT_ISSUE: '', PICKUP_REASON: '운영 검사 성공 커밋 ccccccc (deploy-verify 실행 100)' }
  const r1 = exec(script, fx, env)
  assert.equal(r1.status, 0, r1.stderr + r1.stdout)
  const runs1 = r1.calls.match(/workflow run claude-auto\.yml.*/g) || []
  assert.equal(runs1.length, 1, '정확히 1건 착수')
  assert.match(runs1[0], /이슈 #950 /, '진행 중(#940)·닫힌(#930) 이슈는 건너뛰고 가장 오래된 대기 이슈')
  assert.match(runs1[0], /-f draft=true/, '결과는 Draft PR(승인 전 병합 없음)')
  assert.match(r1.calls, /label POST #950 ai-task-running/, '착수 표시로 중복 방지')
  assert.match(r1.calls, /comment #950 Claude 작업 시작 \(계기: 운영 검사 성공 커밋 ccccccc/, '착수 계기 기록')
  writeFileSync(join(r1.dir, 'calls.log'), '')
  const r2 = runShell(script, r1.dir, env)
  const runs2 = r2.calls.match(/workflow run claude-auto\.yml.*/g) || []
  assert.equal(runs2.length, 1); assert.doesNotMatch(runs2[0], /이슈 #950 /, '두 번째 이벤트: 이미 착수한 #950은 다시 안 집음')
  assert.match(runs2[0], /이슈 #960 .*-f draft=true/, 'needs-lee 이슈도 Draft PR 준비까지만(Ready·병합은 approval-gate·Lee Approve)')
  writeFileSync(join(r1.dir, 'calls.log'), '')
  const r3 = runShell(script, r1.dir, env)
  assert.doesNotMatch(r3.calls, /workflow run/, '대기 이슈가 없으면 아무것도 시작하지 않음')
  console.log('5 작업 큐: 다음 이슈 정확히 1건·중복 착수 없음·needs-lee는 Draft만 통과')
}

// ── 6. 보호 유지: 봇이 병합 직전 판정기·운영 잠금 재확인·sha 고정 병합을 그대로 거친다
{
  for (const must of ['node scripts/decision-approval-gate.mjs', '--merge-lock-check', '-f sha="$sha"', 'scripts/ci/merge-gate-ready.jq', 'scripts/ci/required-checks-pass.jq'])
    assert.ok(botNew.includes(must), `봇 병합 보호 단계 유지: ${must}`)
  assert.ok(existsSync(join(ROOT, 'scripts/ci/merge-reject-class.jq')))
  console.log('6 대표 승인·운영 잠금·필수 검사 보호 단계 유지 통과')
}
// ── 7. Codex 무응답 감지(Lee 2026-11-24): Ready 후 15분 안에 Codex 흔적(리뷰·댓글·반응)이 없으면 라벨+알림 1번, 병합은 막지 않음
{
  const bot = (n, extra = {}) => ({ prs: [prRow(n, false)], pr: { [n]: { ...prData, createdAt: iso(300) } }, checks: green, headDate: iso(10), ...extra })
  const evReady = (n, min) => ({ [n]: [{ event: 'ready_for_review', created_at: iso(min) }] })
  const cx = { user: { login: 'chatgpt-codex-connector[bot]' }, body: 'x', content: 'eyes' }
  // 15분 넘게 무응답 → 라벨 + 댓글(표시 1번)
  const a = exec(botNew, bot(1001, { events: evReady(1001, 20) }))
  assert.equal(a.status, 0, a.stderr)
  assert.match(a.calls, /label POST #1001 codex-silent/, '무응답 → codex-silent 라벨')
  assert.match(a.calls, /comment #1001 <!-- codex-silent -->/, '무응답 → 알림 댓글')
  writeFileSync(join(a.dir, 'calls.log'), '')
  const again = runShell(botNew, a.dir)
  assert.doesNotMatch(again.calls, /comment #1001 <!-- codex-silent -->|label POST #1001/, '이미 라벨이 있으면 다시 알리지 않음')
  // Ready 5분 전 → 알리지 않고 11분 뒤 다시 확인 예약
  const b = exec(botNew, bot(1002, { events: evReady(1002, 5) }))
  assert.doesNotMatch(b.calls, /codex-silent/, '15분 전에는 알리지 않음')
  assert.match(b.stdout, /PR #1002 Codex 반응 아직 없음\(Ready 후 5분\) — 11분 뒤 다시 확인/, '남은 시간을 기존 대기 파일에 올림')
  assert.match(b.calls, /codex-wait-timer\.yml/, '기존 타이머로 다시 확인(가장 이른 시각 기준)')
  // PR은 오래됐어도 Ready 전환이 방금이면(Draft 기간 제외) 알리지 않음
  assert.doesNotMatch(exec(botNew, bot(1003, { events: evReady(1003, 2) })).calls, /codex-silent/, 'Draft 기간은 세지 않음')
  // Codex 흔적(👀 반응·댓글·리뷰·줄 댓글) 중 하나라도 있으면 알리지 않음
  for (const [name, fx] of [['반응', { reactions: { 1004: [cx] } }], ['댓글', { comments: { 1004: [cx] } }]])
    assert.doesNotMatch(exec(botNew, bot(1004, { events: evReady(1004, 20), ...fx })).calls, /codex-silent/, `Codex ${name}이 있으면 알리지 않음`)
  for (const [name, key] of [['리뷰', 'reviews'], ['줄 댓글', 'reviewComments']]) {
    const fx = bot(1004, { events: evReady(1004, 20) }); fx.pr[1004] = { ...fx.pr[1004], [key]: [{ ...cx, state: 'COMMENTED', commit_id: SHA, submitted_at: iso(1) }] }
    assert.doesNotMatch(exec(botNew, fx).calls, /codex-silent/, `Codex ${name}이 있으면 알리지 않음`)
  }
  // 봇 PR이 아니면 대상 아님 / 조회 실패는 거짓 경보 없이 건너뜀 / 무응답이어도 병합 판정은 그대로(알림은 병합 조건 아님)
  const human = bot(1005, { events: evReady(1005, 20) }); human.prs[0].author.login = 'someone'
  assert.doesNotMatch(exec(botNew, human).calls, /codex-silent/, '봇 PR 아닌 PR은 대상 아님')
  assert.doesNotMatch(exec(botNew, bot(1006, { events: evReady(1006, 20), failPaths: ['/reactions'] })).calls, /codex-silent/, '조회 실패는 알림 없이 건너뜀')
  assert.ok(botNew.indexOf('codex-silent.sh') < botNew.indexOf('node scripts/decision-approval-gate.mjs'), '감지는 병합 판정보다 앞에서 돌고 판정 결과와 무관')
  console.log('7 Codex 무응답 감지: 15분 넘으면 라벨·알림 1번, Draft 기간·Codex 흔적·봇 아님·조회 실패는 알리지 않음 통과')
}
console.log('automerge-recovery.test.mjs: 전부 통과')

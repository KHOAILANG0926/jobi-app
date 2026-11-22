// S8 트랙 A(#808): 병합 뒤 후속 검사 연결 시험 — 행정구역 핀 검사(administrative-pin-check)는 운영 배포 확인(deploy-verify) '최신 실행'이 success인 같은 커밋에서만, 한 번만 돈다.
// 실제 워크플로 YAML(PyYAML — pr-checks.yml의 열쇠·PR 코드 분리 검사가 이미 쓰는 도구)의 이벤트·조건·호출·쉘을 읽어 병합 경로를 흉내 낸다. 해석할 수 없는 식·호출 모양은 시험 실패(닫힌 실패).
// 핀 검사 gate 단계와 봇 병합기의 후속 검사 호출 블록은 YAML에서 꺼낸 실제 쉘을 가짜 gh로 실행한다. GitHub 동작 가정 두 가지를 모두 시험: A1 = GITHUB_TOKEN이 시작한 실행의 workflow_run도 시작됨, A2 = 시작되지 않음.
// 사용: node scripts/ci/post-merge-chain.test.mjs (정상 시험 + 결함 주입이 모두 잡히는지) | --mutate N (결함 N을 넣고 시험 — exit 1이어야 함)
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const PIN = 'administrative-pin-check', DV = 'deploy-verify', HUB = 'vercel-deploy', BOT = 'bot-pr-automerge'
const TARGETS = ['job-rules-apply', 'occupation-r8-apply', 'jobcard-integrity', 'ai-reader-calibration', 'job-ocr-check'] // 봇 병합기가 병합 뒤 경로를 보고 부르는 검사들(뒤 2개 Lee 2026-11-21 추가)
const SHA = 'a'.repeat(40), TITLE = (s) => `행정구역 핀 검사 ${s}`
const SINCE = '2026-11-19T01:00:00Z', OLD = (i) => `2026-11-19T00:0${i}:00Z`, NEW = '2026-11-19T02:00:00Z' // since 이전 = 이전 실행, 이후 = 이번 vercel-deploy가 부른 실행
const NAMES = [HUB, DV, PIN, BOT, ...TARGETS]
export const load = () => { // 한 번의 PyYAML 호출로 모두 읽는다. YAML 1.1은 on:을 true로 읽는다
  const all = JSON.parse(execFileSync('python3', ['-c', 'import sys,json,yaml;print(json.dumps([yaml.safe_load(open(f,encoding="utf-8")) for f in sys.argv[1:]]))', ...NAMES.map((n) => join(ROOT, `.github/workflows/${n}.yml`))], { encoding: 'utf8' }))
  return Object.fromEntries(NAMES.map((n, i) => { const w = all[i]; w.on = w.on ?? w.true; return [n, w] }))
}

// 식: 이름·문자열·&& || ! == != ( ) success()만 허용하고 JS로 계산한다. 그 밖(다른 함수·글자)은 던진다.
const evalExpr = (src, ctx) => {
  const V = (path) => path.split('.').reduce((o, k) => (o != null && typeof o === 'object' && k in o ? o[k] : ''), ctx)
  const js = String(src).replace(/^\s*\$\{\{|\}\}\s*$/g, '').replace(/'((?:[^']|'')*)'|([A-Za-z_][\w.-]*)(\(\))?/g, (_, s, id, call) => {
    if (s !== undefined) return JSON.stringify(s.replace(/''/g, "'"))
    if (call) { if (id === 'success') return 'true'; throw new Error(`식 해석 불가(함수 ${id}()): ${src}`) }
    return id === 'true' || id === 'false' ? id : `V(${JSON.stringify(id)})`
  })
  if (/[^\s()!=&|]/.test(js.replace(/V\("[^"]*"\)|"(?:[^"\\]|\\.)*"|\btrue\b|\bfalse\b/g, ''))) throw new Error(`식 해석 불가: ${src}`)
  return Function('V', `return (${js})`)(V)
}
const interp = (s, ctx) => String(s ?? '').replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e) => String(evalExpr(e, ctx)))

// 봇 병합기가 읽는 대상 5개의 실제 YAML 구조: push는 branches에 master가 있고 paths는 지원하는 패턴만 담은 목록이어야 한다. 병합기의 awk 읽기 결과는 PyYAML 결과와 같아야 한다.
export function checkTargets(W) {
  const prog = /pats=\$\(awk '([^']+)'/.exec(botRun(W))?.[1]; assert.ok(prog, '봇 병합기에서 paths 읽기(awk)를 찾지 못함')
  for (const n of TARGETS) {
    const push = W[n].on.push
    assert.ok(push?.branches?.includes('master'), `${n}: push.branches에 master가 있어야 함`)
    assert.ok(Array.isArray(push.paths) && push.paths.length, `${n}: push.paths가 비어 있지 않은 목록이어야 함`)
    for (const k of ['paths-ignore', 'branches-ignore', 'tags', 'tags-ignore']) assert.ok(!(k in push), `${n}: push.${k}는 봇 병합기가 해석하지 못함`)
    for (const pat of push.paths) assert.ok(!/^!|[?+\[\]\\]/.test(pat), `${n}: 지원하지 않는 paths 패턴 '${pat}'`)
    const f = join(mkdtempSync(join(tmpdir(), 'tgt-')), `${n}.yml`); writeFileSync(f, readFileSync(join(ROOT, `.github/workflows/${n}.yml`), 'utf8'))
    assert.deepEqual(spawnSync('awk', [prog, f], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean), push.paths, `${n}: 봇 병합기의 paths 읽기가 YAML과 다름`)
  }
}
// `gh workflow run X.yml` 호출 읽기: 줄 맨 앞 호출, `since=$(…) && [ -n "$since" ] && gh workflow run …`, 또는 한 줄 `if [ "${{ github.event_name }}" = 이벤트 ]; then gh workflow run X.yml …; fi`만 인정. 그 밖은 던진다.
export function dispatchSites(run, targets) {
  const sites = []
  for (const raw of String(run).split('\n')) {
    const line = raw.trim(), m = /gh workflow run\s+([\w.-]+)\.yml/.exec(line)
    if (!m || line.startsWith('#') || !targets.includes(m[1])) continue
    const c = /^if \[ "\$\{\{ github\.event_name \}\}" = (\w+) \]; then gh workflow run [\w.-]+\.yml[^;]*; fi$/.exec(line)
    const sinceForm = /^since=\$\([^)]*\) && \[ -n "\$since" \] && gh workflow run /.test(line) // vercel-deploy의 핀 검사 호출: 시작 시각을 읽어 넘김(실패는 뒤의 || 처리가 맡음)
    if (!line.startsWith('gh workflow run') && !c && !sinceForm) throw new Error(`호출 조건을 해석할 수 없음: ${line.slice(0, 140)}`)
    sites.push({ target: m[1], event: c ? c[1] : null })
  }
  return sites
}

const ctxOf = (ev, extra = {}) => ({ github: { event_name: ev, ref: 'refs/heads/master', sha: SHA, repository: 'o/r', run_id: '1', event: {}, server_url: 'https://github.com', ...extra.github }, inputs: extra.inputs ?? {}, steps: extra.steps ?? {}, secrets: {} })
/** sc: { origin: human-push|bot-merge|manual-hub|manual-dv|manual-pin|schedule, need, dv, dvList, noDv, history, extraPin, extraFailedDvRun(실패한 deploy-verify에서 파생된 실행 추가), overlap(대기 실행 교체), checkFails(앞의 n번 검사 시도가 실패), dvRaw(deploy-verify 실행 목록: 문자열=완료 결과 | {conclusion,status,old,sha}), eventDv(workflow_run 이벤트가 가리키는 목록 위치), noSince, apiFail, noEvent(완료 이벤트 없음), wr(A1 true/A2 false) } → { executed, attempts, failedRuns, pinCalls, dvCalls, errors } */
export function simulate(W, sc) {
  const calls = { [PIN]: 0, [DV]: 0 }, queue = [], pins = [], dvRuns = []
  const start = (wf, ev, token, extra = {}) => queue.push({ wf, ev, token, ctx: ctxOf(ev, { ...extra, steps: { need: { outputs: sc.need ?? {} } } }) })
  const exec = (r) => Object.values(W[r.wf].jobs ?? {}).flatMap((job) => {
    const hits = (job.steps ?? []).filter((s) => typeof s.run === 'string').map((s) => ({ s, sites: dispatchSites(s.run, [PIN, DV, HUB]) })).filter((x) => x.sites.length)
    if (!hits.length || (job.if !== undefined && !evalExpr(job.if, r.ctx))) return []
    return hits.filter(({ s }) => s.if === undefined || evalExpr(s.if, r.ctx)).flatMap(({ sites }) => sites.filter((x) => x.event === null || x.event === r.ev).map((x) => x.target))
  })
  const dvConclusion = sc.dvList ? sc.dvList.at(-1) : sc.dv ?? 'success'
  const specs = sc.noDv ? [] : (sc.dvRaw ?? sc.dvList ?? [dvConclusion]).map((x) => (typeof x === 'string' ? { conclusion: x } : x))
  const dv = specs.map((x, i) => ({ id: 100 + i, head_sha: x.sha ?? sc.dvSha ?? SHA, status: x.status ?? 'completed', conclusion: x.conclusion ?? null, created_at: x.at ?? (x.old ? OLD(i) : i === specs.length - 1 ? NEW : OLD(i)), event: x.event ?? 'workflow_dispatch' }))
  const eventId = 100 + (sc.eventDv ?? Math.max(specs.length - 1, 0)), pinInputs = { sha: SHA, since: sc.noSince ? '' : SINCE }
  if (sc.origin === 'human-push') { for (const n of [HUB, DV]) if (W[n].on.push && !W[n].on.push.paths) start(n, 'push', false) }
  else if (sc.origin === 'bot-merge') { // 봇 병합(GITHUB_TOKEN)은 push 이벤트로 새 실행을 시작하지 않는다 — 봇이 부르는 배포 호출 하나만 시작된다
    const n = Object.values(W[BOT].jobs).flatMap((j) => j.steps).flatMap((s) => (typeof s.run === 'string' ? dispatchSites(s.run, [HUB]) : [])).length
    assert.equal(n, 1, `봇 병합기의 ${HUB} 호출은 정확히 1개여야 함(지금 ${n}개)`); assert.ok('workflow_dispatch' in W[HUB].on)
    start(HUB, 'workflow_dispatch', true)
  } else if (sc.origin === 'manual-hub') start(HUB, 'workflow_dispatch', false)
  else if (sc.origin === 'manual-dv') start(DV, 'workflow_dispatch', false)
  else if (sc.origin === 'manual-pin') start(PIN, 'workflow_dispatch', false)
  else if (sc.origin === 'schedule') start(HUB, 'schedule', true)
  else throw new Error('모르는 계기 ' + sc.origin)
  while (queue.length) {
    const r = queue.shift()
    if (r.wf === PIN) { pins.push(r); continue }
    for (const t of exec(r)) { if (t === PIN) calls[PIN]++; if (t === DV) calls[DV]++; start(t, 'workflow_dispatch', true, t === PIN ? { inputs: pinInputs } : {}) }
    if (r.wf === DV && !sc.noDv) {
      dvRuns.push(r)
      const wr = W[PIN].on.workflow_run // 완료 이벤트: 사람이 시작한 실행은 늘, GITHUB_TOKEN이 시작한 실행은 가정(A1/A2)에 따라
      if (!sc.noEvent && wr?.workflows?.includes(W[DV].name) && wr.types?.includes('completed') && wr.branches?.includes('master') && (!r.token || sc.wr))
        start(PIN, 'workflow_run', false, { github: { event: { workflow_run: { id: eventId, head_sha: sc.dvSha ?? SHA, conclusion: dv.find((d) => d.id === eventId)?.conclusion ?? dvConclusion } } } })
    }
  }
  if (sc.extraPin) start(PIN, 'workflow_dispatch', false, { inputs: pinInputs }) && pins.push(queue.pop())
  if (sc.extraFailedDvRun) start(PIN, 'workflow_run', false, { github: { event: { workflow_run: { id: 999, head_sha: SHA, conclusion: 'failure' } } } }) && pins.push(queue.pop())
  const wf = W[PIN], job = Object.values(wf.jobs)[0], gate = job.steps.find((s) => s.id === 'gate'), done = [], errors = []
  let executed = 0, attempts = 0, failedRuns = 0, failsLeft = sc.checkFails ?? 0
  // concurrency(cancel-in-progress: false)가 있으면 같은 그룹의 실행은 한 줄로 서서 앞 실행의 끝난 결과를 본다. 없으면 동시 실행끼리는 서로를 못 본다(최악).
  // 워크플로 수준 concurrency는 job if로 건너뛰는 실행도 그룹 자리를 차지한다고 보고, job 수준은 건너뛰는 실행이 자리를 차지하지 않는다고 본다(후자는 실제 GitHub 동작 미검증 — 아래 잔여 위험).
  const cc = wf.concurrency ?? job.concurrency, jobLevel = !wf.concurrency && !!job.concurrency
  const serial = cc && cc['cancel-in-progress'] === false
  const groupOf = (r) => (cc ? interp(cc.group, r.ctx) : null)
  const parts = pins.filter((r) => !jobLevel || job.if === undefined || evalExpr(job.if, r.ctx))
  // 한 그룹에는 실행 중 1개 + 대기 1개만 둔다: 모두 겹쳐 도착하면 첫 실행만 실행 중이고, 가운데 대기 실행은 마지막 대기 실행으로 교체(취소)된다.
  const replaced = new Set(sc.overlap && serial ? parts.filter((r, i) => i > 0 && i < parts.length - 1 && groupOf(r) === groupOf(parts[0])) : [])
  pins.forEach((r, i) => {
    r.ctx.github.run_id = String(1000 + i)
    const rec = { id: 1000 + i, status: 'completed', display_title: interp(wf['run-name'], r.ctx), group: groupOf(r) }
    done.push(rec)
    rec.real = false // 검사 단계가 실제로 success였는가(건너뜀·실패·취소는 아님)
    if (replaced.has(r)) { rec.conclusion = 'cancelled'; return }
    if (job.if !== undefined && !evalExpr(job.if, r.ctx)) { rec.conclusion = 'skipped'; return }
    const seen = [...(sc.history ?? []), ...done.slice(0, -1).filter((d) => serial && d.group === rec.group)]
    const out = runGate(gate.run, Object.fromEntries(Object.entries(gate.env ?? {}).map(([k, v]) => [k, interp(v, r.ctx)])), dv, seen, sc.apiFail, sc.late ? { add: sc.late.add?.map((x) => ({ id: x.id, head_sha: SHA, status: 'completed', conclusion: x.conclusion ?? 'success', created_at: x.at, event: x.event ?? 'workflow_dispatch' })), replace: sc.late.replace?.map((x) => ({ id: x.id, head_sha: SHA, status: 'completed', conclusion: 'success', created_at: x.at, event: 'workflow_dispatch' })), fail: sc.late.fail } : null)
    rec.conclusion = out.failed ? 'failure' : 'success'
    if (out.failed) errors.push(out.err)
    if (!out.failed && out.go && (r.ctx.github.event.workflow_run?.head_sha || r.ctx.inputs.sha || SHA) === SHA) { // 검사 단계의 실제 쉘(2번 시도)을 가짜 node로 실행한다. 검사 자체가 실패한 실행도 실행 1회로 센다
      executed++
      const c = runCheck(wf, r.ctx, failsLeft); attempts += c.attempts; failsLeft -= c.status === 0 ? c.attempts - 1 : c.attempts
      rec.real = c.status === 0; if (!rec.real) { rec.conclusion = 'failure'; failedRuns++ }
    }
  })
  return { executed, attempts, failedRuns, pinCalls: calls[PIN], dvCalls: calls[DV], errors }
}

// gate 단계의 실제 쉘을 가짜 gh·sleep으로 실행한다.
function runGate(script, env, dvRuns, pinRuns, apiFail = false, late = null) {
  const dir = mkdtempSync(join(tmpdir(), 'pin-gate-')), bin = join(dir, 'bin'); mkdirSync(bin)
  writeFileSync(join(dir, 'dv.json'), JSON.stringify({ workflow_runs: dvRuns })); writeFileSync(join(dir, 'pin.json'), JSON.stringify({ workflow_runs: pinRuns })); writeFileSync(join(dir, 'out'), ''); writeFileSync(join(dir, 'lcnt'), '0')
  if (late?.add) writeFileSync(join(dir, 'dv2.json'), JSON.stringify({ workflow_runs: [...dvRuns, ...late.add] })); if (late?.replace) writeFileSync(join(dir, 'dv2.json'), JSON.stringify({ workflow_runs: late.replace }))
  writeFileSync(join(bin, 'gh'), `#!/bin/bash
case "$2" in
  *workflows/deploy-verify.yml/runs*) [ -n "$FAIL_DV" ] && { echo "gh: HTTP 502" >&2; exit 1; }; n=$(cat "${dir}/lcnt"); echo $((n+1)) > "${dir}/lcnt"; f="${dir}/dv.json"; [ "$n" -ge 1 ] && [ -f "${dir}/dv2.json" ] && f="${dir}/dv2.json"; [ "$n" -ge 1 ] && [ -n "$FAIL_LATE" ] && { echo "gh: HTTP 502" >&2; exit 1; }; s="\${2#*head_sha=}"; s="\${s%%&*}"; jq --arg s "$s" '{workflow_runs:[.workflow_runs[]|select(.head_sha==$s)]}' "$f" ;;
  *workflows/administrative-pin-check.yml/runs*) cat "${dir}/pin.json" ;;
  *actions/runs/*/jobs) id="\${2#*actions/runs/}"; id="\${id%%/*}"; jq --argjson id "$id" '{jobs:[{steps:[{name:"gate",conclusion:"success"},{name:"All public source points are inside their original province",conclusion:(([.workflow_runs[]|select(.id==$id)][0]|if has("real") then .real else (.conclusion=="success") end)|if . then "success" else "skipped" end)}]}]}' "${dir}/pin.json" ;;
  *actions/runs/[0-9]*) [ -n "$FAIL_DV" ] && { echo "gh: HTTP 502" >&2; exit 1; }; id="\${2#*actions/runs/}"; jq --argjson id "$id" '[.workflow_runs[]|select(.id==$id)][0] // {}' "${dir}/dv.json" ;;
  *) echo "fake gh: unexpected $*" >&2; exit 2 ;;
esac
`); writeFileSync(join(bin, 'sleep'), '#!/bin/bash\nexit 0\n')
  for (const f of ['gh', 'sleep']) chmodSync(join(bin, f), 0o755)
  const r = spawnSync('bash', ['-e', '-c', script], { env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, GITHUB_OUTPUT: join(dir, 'out'), PIN_WAIT_TRIES: '3', FAIL_DV: apiFail ? '1' : '', FAIL_LATE: late?.fail ? '1' : '', ...env }, encoding: 'utf8' })
  return { go: /^go=true$/m.test(readFileSync(join(dir, 'out'), 'utf8')), failed: r.status !== 0, err: (r.stdout + r.stderr).trim() }
}

// 검사 단계(최대 2번 시도)의 실제 쉘을 가짜 node·sleep으로 실행한다. 가짜 node는 앞의 fails번 호출이 실패한다.
function runCheck(wf, ctx, fails) {
  const step = Object.values(wf.jobs)[0].steps.find((s) => (s.name ?? '').startsWith('All public source points'))
  const dir = mkdtempSync(join(tmpdir(), 'pin-check-')), bin = join(dir, 'bin'); mkdirSync(bin); writeFileSync(join(dir, 'cnt'), '0'); writeFileSync(join(dir, 'summary'), '')
  writeFileSync(join(bin, 'node'), `#!/bin/bash\nn=$(cat "${dir}/cnt"); n=$((n+1)); echo $n > "${dir}/cnt"\n[ "$n" -le "${Math.max(fails, 0)}" ] && { echo "원인표시-$n: 핀 위치 오류" >&2; exit 1; }\nexit 0\n`); writeFileSync(join(bin, 'sleep'), '#!/bin/bash\nexit 0\n')
  for (const f of ['node', 'sleep']) chmodSync(join(bin, f), 0o755)
  const r = spawnSync('bash', ['-e', '-c', interp(step.run, ctx)], { env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, PIN_SHA: SHA, GITHUB_STEP_SUMMARY: join(dir, 'summary') }, encoding: 'utf8' })
  return { status: r.status, attempts: Number(readFileSync(join(dir, 'cnt'), 'utf8')), out: r.stdout + r.stderr, summary: readFileSync(join(dir, 'summary'), 'utf8') }
}

// ---------- 시나리오: [이름, 계기, need, dv 결과(또는 목록), 기대 실행 횟수, 워크플로가 핀 검사를 직접 부를 수 있는 최대 횟수, 추가 조건] ----------
const H = (conclusion, status = 'completed', id = 5, real) => ({ id, status, conclusion, display_title: TITLE(SHA), ...(real === undefined ? {} : { real }) }) // real: 검사 단계가 실제로 success였는가(기본: conclusion이 success면 true)
const go1 = { go: '1' }, go0 = { go: '0' }
export const SCENARIOS = [
  ['1 일반 master push(배포 있음)', 'human-push', go1, 'success', 1, 0],
  ['2a 배포 생략 — push', 'human-push', go0, 'success', 1, 0],
  ['2b 배포 생략 — 봇 병합', 'bot-merge', go0, 'success', 1, 1],
  ['3a 수동 dispatch — vercel-deploy(배포 있음)', 'manual-hub', go1, 'success', 1, 1],
  ['3b 수동 dispatch — vercel-deploy(배포 생략)', 'manual-hub', go0, 'success', 1, 1],
  ['3c 수동 dispatch — deploy-verify 직접', 'manual-dv', {}, 'success', 1, 0],
  ['3d 수동 dispatch — 핀 검사 sha 없이(최신 deploy-verify 성공)', 'manual-pin', {}, ['success'], 1, 0],
  ['3e 수동 dispatch — 핀 검사 sha 없이(최신 deploy-verify 실패)', 'manual-pin', {}, ['failure'], 0, 0],
  ['3f 수동 dispatch — 핀 검사 sha 없이(deploy-verify 기록 없음)', 'manual-pin', {}, [], 0, 0],
  ['4a 봇 자동 병합(배포 있음)', 'bot-merge', go1, 'success', 1, 1],
  ['4b 봇 병합 + 같은 시각 수동 sha 실행(동시 경쟁 3건)', 'bot-merge', go1, 'success', 1, 1, { extraPin: true }],
  ['4c 봇 병합 + 앞선 다른 커밋의 핀 검사 기록', 'bot-merge', go1, 'success', 1, 1, { history: [{ ...H('success'), display_title: TITLE('b'.repeat(40)) }] }],
  ['5a deploy-verify 실패 — push', 'human-push', go1, 'failure', 0, 0],
  ['5b deploy-verify 실패 — 봇 병합', 'bot-merge', go1, 'failure', 0, 1],
  ['5c deploy-verify 취소 — 봇 병합', 'bot-merge', go1, 'cancelled', 0, 1],
  ['5d deploy-verify 미실행 — 봇 병합', 'bot-merge', go1, 'success', 0, 1, { noDv: true }],
  ['5e 다른 커밋의 deploy-verify 성공만 있음(SHA 섞임)', 'bot-merge', go1, 'success', 0, 1, { dvSha: 'c'.repeat(40) }],
  ['6a 예약 따라잡기 배포', 'schedule', go1, 'success', 1, 1],
  ['6b 예약 — 운영이 이미 같은 커밋(불필요한 추가 실행 없음)', 'schedule', { go: '0', same: '1' }, 'success', 0, 0, { wantDv: 0 }],
  ['7a 이전 핀 검사 failure → 다시 실행 통과', 'human-push', go1, 'success', 1, 0, { history: [H('failure')] }],
  ['7b 이전 핀 검사 cancelled → 다시 실행 통과', 'human-push', go1, 'success', 1, 0, { history: [H('cancelled')] }],
  ['7c 이전 핀 검사 skipped → 다시 실행 통과', 'human-push', go1, 'success', 1, 0, { history: [H('skipped')] }],
  ['7d 이전 핀 검사 success → 건너뜀(중복)', 'human-push', go1, 'success', 0, 0, { history: [H('success')] }],
  ['7e 이전 핀 검사 in_progress → 건너뜀(중복)', 'human-push', go1, 'success', 0, 0, { history: [H(null, 'in_progress')] }],
  ['7f 이전 핀 검사 queued → 건너뜀(중복)', 'human-push', go1, 'success', 0, 0, { history: [H(null, 'queued')] }],
  ['8a 과거 성공 + 최신 실패 → 통과 안 함(봇 병합)', 'bot-merge', go1, ['success', 'failure'], 0, 1],
  ['8b 과거 성공 + 최신 취소 → 통과 안 함(봇 병합)', 'bot-merge', go1, ['success', 'cancelled'], 0, 1],
  ['8c 과거 성공 + 최신 실패 → 통과 안 함(sha 없는 수동)', 'manual-pin', {}, ['success', 'failure'], 0, 0],
  ['8d 과거 실패 + 최신 성공 → 통과(봇 병합)', 'bot-merge', go1, ['failure', 'success'], 1, 1],
  ['9a 동시 3건 겹침 + 대기 실행 교체(가운데 실행 취소) → 누락·중복 없음', 'bot-merge', go1, 'success', 1, 1, { extraPin: true, overlap: true }],
  ['9b 앞선 실행의 검사가 2번 모두 실패 → 같은 병합의 다음 실행이 다시 검사(A1) / 다음 실행 없음(A2)', 'bot-merge', go1, 'success', { A1: 2, A2: 1 }, 1, { checkFails: 2 }],
  ['9c 앞선 실행의 검사 2번 실패 + 대기 실행 교체 → 마지막 대기 실행이 다시 검사(누락 없음)', 'bot-merge', go1, 'success', 2, 1, { checkFails: 2, extraPin: true, overlap: true }],
  ['10a 앞선 실행이 success지만 검사는 건너뜀 → 이번 실행은 검사 실행', 'human-push', go1, 'success', 1, 0, { history: [H('success', 'completed', 5, false)] }],
  ['10b 앞선 [실제 검사 실패 → 건너뜀 success] → 이번 실행은 검사 실행', 'human-push', go1, 'success', 1, 0, { history: [H('failure', 'completed', 5, false), H('success', 'completed', 6, false)] }],
  ['10c 앞선 [건너뜀 success + 실제 검사 success] → 건너뜀(중복)', 'human-push', go1, 'success', 0, 0, { history: [H('success', 'completed', 5, false), H('success', 'completed', 6, true)] }],
  ['11a 실패한 deploy-verify에서 파생된 실행이 대기 자리를 차지해도 정상 대기 실행이 밀리지 않음', 'bot-merge', go1, 'success', 2, 1, { checkFails: 2, extraPin: true, overlap: true, extraFailedDvRun: true }],
  ['12a 검사 첫 시도 실패 → 같은 실행 안에서 재시도 성공(실패 실행 없음, 시도 2번)', 'bot-merge', go1, 'success', 1, 1, { checkFails: 1, wantFail: 0, wantAttempts: 2 }],
  ['12b 검사 2번 모두 실패 → 최종 failure 기록(A2는 자동 후속 없음, A1은 workflow_run 실행이 다시 검사)', 'bot-merge', go1, 'success', { A1: 2, A2: 1 }, 1, { checkFails: 2, wantFail: 1 }],
  ['12c 계속 실패해도 시도는 실행당 2번뿐(무한 재시도 없음)', 'bot-merge', go1, 'success', { A1: 2, A2: 1 }, 1, { checkFails: 99, wantFail: { A1: 2, A2: 1 }, wantAttempts: { A1: 4, A2: 2 } }],
  ['13a 같은 SHA 이전 성공 + 신규 실행이 아직 목록에 없음(조회 지연) → 이전 성공을 인정 안 함', 'bot-merge', go1, [{ conclusion: 'success', old: true }], 0, 1, { noEvent: true }],
  ['13b 이전 성공 + 신규 실행 진행 중 → 통과 안 함', 'bot-merge', go1, [{ conclusion: 'success', old: true }, { status: 'in_progress', conclusion: null }], 0, 1, { noEvent: true }],
  ['13c 이전 성공 + 신규 실패 → 통과 안 함', 'bot-merge', go1, [{ conclusion: 'success', old: true }, 'failure'], 0, 1],
  ['13d 이전 성공 + 신규 성공 → 통과', 'bot-merge', go1, [{ conclusion: 'success', old: true }, 'success'], 1, 1],
  ['13e since 없음(deploy-verify 식별 불가) → A2는 통과 안 함, A1은 workflow_run 이벤트 실행만 통과', 'bot-merge', go1, 'success', { A1: 1, A2: 0 }, 1, { noSince: true }],
  ['13f deploy-verify 조회(API) 실패 → 성공으로 처리 안 함', 'bot-merge', go1, 'success', 0, 1, { apiFail: true }],
  ['13g workflow_run 이벤트가 과거 성공을 가리키고 더 최근 실패 실행이 있음(실행 ID 불일치) → 통과 안 함', 'human-push', go1, ['success', 'failure'], 0, 0, { eventDv: 0 }],
  ['13h 이벤트의 실행 커밋이 검사 대상과 다름(커밋 불일치) → 통과 안 함', 'human-push', go1, [{ conclusion: 'success', sha: 'c'.repeat(40) }], 0, 0],
  ['14a since 이후 직접 실행 후보가 2개 → 구분 불가: 가장 이른 것을 고르지 않고 실패(A2는 통과 안 함)', 'bot-merge', go1, [{ conclusion: 'failure', at: '2026-11-19T01:30:00Z' }, 'success'], { A1: 1, A2: 0 }, 1, { wantErr: '구분할 수 없음' }],
  ['14b since 이후 후보 1개(직접 실행) + push 실행 1개 → 직접 실행 1개로 식별해 통과', 'bot-merge', go1, [{ conclusion: 'failure', event: 'push', at: '2026-11-19T01:30:00Z' }, 'success'], 1, 1],
  ['14c since 이후 후보가 0개(push 실행만 있음) → 식별 못 해 통과 안 함(A2)', 'bot-merge', go1, [{ conclusion: 'success', event: 'push' }], { A1: 1, A2: 0 }, 1, { wantErr: '식별하지 못함' }],
  ['14d since 이후 후보 1개 + since 이전 직접 실행 성공 1개 → 새 실행만 인정(이전 성공 무시, 실패면 통과 안 함)', 'bot-merge', go1, [{ conclusion: 'success', old: true }, 'failure'], 0, 1],
  ['14e 검사 1번 실패 후 성공 → 실패 실행 0개, 시도 2번', 'bot-merge', go1, 'success', 1, 1, { checkFails: 1, wantFail: 0, wantAttempts: { A1: 2, A2: 2 } }],
  ['14f 검사 2번 실패 → 최종 실패 1개·시도 2번(A1은 workflow_run 이벤트 실행이 다시 검사해 성공 — 시도 합계 3번)', 'bot-merge', go1, 'success', { A1: 2, A2: 1 }, 1, { checkFails: 2, wantFail: { A1: 1, A2: 1 }, wantAttempts: { A1: 3, A2: 2 } }],
  ['15a 첫 조회 후보 1개 → 허용 직전 재조회에서 2개(두 번째 후보 생성) → 통과 안 함(A2), A1은 workflow_run 이벤트 실행만', 'bot-merge', go1, 'success', { A1: 1, A2: 0 }, 1, { late: { add: [{ id: 150, at: '2026-11-19T02:30:00Z' }] }, wantErr: '재확인 실패' }],
  ['15b 첫 조회 1개 → 재조회에서 다른 Run ID 1개로 바뀜 → 통과 안 함', 'bot-merge', go1, 'success', { A1: 1, A2: 0 }, 1, { late: { replace: [{ id: 150, at: '2026-11-19T02:30:00Z' }] }, wantErr: '재확인 실패' }],
  ['15c 재조회 API 실패 → 성공 처리 안 함', 'bot-merge', go1, 'success', { A1: 1, A2: 0 }, 1, { late: { fail: true } }],
  ['15d 첫 조회 1개 → 재조회도 같은 1개 → 통과', 'bot-merge', go1, 'success', 1, 1, { late: { replace: [{ id: 100, at: '2026-11-19T02:00:00Z' }] } }],
].map(([name, origin, need, dv, want, maxPin, more = {}]) => ({ name, sc: { origin, need, ...(Array.isArray(dv) ? (dv.some((x) => typeof x === 'object') ? { dvRaw: dv } : { dvList: dv }) : { dv }), ...more }, want, maxPin }))
export function runSuite(W) {
  checkTargets(W); checkHub(W); runHubCases(W)
  { // 최종 실패(2번 모두 실패)에는 Run ID·커밋 SHA·오류 원인이 로그와 요약에 남아야 한다
    const ctx = ctxOf('workflow_dispatch'); ctx.github.run_id = '4242'; const c = runCheck(W[PIN], ctx, 2)
    assert.equal(c.status, 1, '2번 모두 실패하면 단계는 실패여야 함'); assert.equal(c.attempts, 2, '시도는 정확히 2번')
    for (const [where, t] of [['로그', c.out], ['요약', c.summary]]) for (const need of ['4242', SHA.slice(0, 7), '원인표시-2']) assert.ok(t.includes(need), `최종 실패 ${where}에 '${need}'가 없음: ${t.slice(-200)}`)
  }
  for (const wr of [true, false]) for (const { name, sc, want, maxPin } of SCENARIOS) {
    const r = simulate(W, { ...sc, wr }), tag = `[${name} | workflow_run ${wr ? 'A1(시작)' : 'A2(미시작)'}]`
    const w = typeof want === 'object' ? want[wr ? 'A1' : 'A2'] : want
    assert.equal(r.executed, w, `${tag} 핀 검사 ${r.executed}회 실행(기대 ${w}회) ${r.errors.join(' / ').slice(0, 160)}`)
    assert.ok(r.pinCalls <= maxPin, `${tag} 핀 검사 직접 호출 ${r.pinCalls}회(최대 ${maxPin}) — 중복 호출`)
    assert.ok(r.attempts <= 2 * r.executed, `${tag} 검사 시도 ${r.attempts}번 > 실행 ${r.executed}회 × 2 — 재시도가 한도를 넘음`)
    const pick = (v) => (typeof v === 'object' ? v[wr ? 'A1' : 'A2'] : v)
    if (sc.wantFail !== undefined) assert.equal(r.failedRuns, pick(sc.wantFail), `${tag} 최종 실패 실행 ${r.failedRuns}개(기대 ${pick(sc.wantFail)}개)`)
    if (sc.wantAttempts !== undefined) assert.equal(r.attempts, pick(sc.wantAttempts), `${tag} 검사 시도 ${r.attempts}번(기대 ${pick(sc.wantAttempts)}번)`)
    if (sc.wantErr !== undefined) assert.ok(r.errors.join(' / ').includes(sc.wantErr), `${tag} 오류 기록에 '${sc.wantErr}'가 없음: ${r.errors.join(' / ').slice(0, 200)}`)
    if (sc.wantDv !== undefined) assert.equal(r.dvCalls, sc.wantDv, `${tag} deploy-verify 호출 ${r.dvCalls}회(기대 ${sc.wantDv}) — 불필요한 추가 실행`)
  }
}

// ---------- 봇 병합기의 후속 검사 호출 블록(실제 쉘 실행) ----------
const botRun = (W) => Object.values(W[BOT].jobs).flatMap((j) => j.steps).map((s) => s.run).find((r) => typeof r === 'string' && r.includes('for wf in job-rules-apply'))
export function runBotBlock(W, files, { yml = (t) => t, ghFail = '' } = {}) {
  const run = botRun(W); assert.ok(run, '봇 병합기에 후속 검사 호출 블록이 있어야 함')
  assert.ok(/if \[ -s dispatch-fail\.txt \]; then[^\n]*exit 1; fi\s*$/.test(run.trim()), '봇 병합기 맨 끝에서 dispatch-fail.txt를 확인해 실패로 끝내야 함')
  const block = /^( *)jq -r '\.\[\]\.filename' files\.json > changed\.txt\n[\s\S]*?^\1done$/m.exec(run)?.[0]; assert.ok(block, '후속 검사 호출 블록을 찾지 못함')
  const dir = mkdtempSync(join(tmpdir(), 'bot-block-')); mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, '.github/workflows'), { recursive: true })
  for (const n of TARGETS) writeFileSync(join(dir, `.github/workflows/${n}.yml`), n === 'jobcard-integrity' ? yml(readFileSync(join(ROOT, `.github/workflows/${n}.yml`), 'utf8')) : readFileSync(join(ROOT, `.github/workflows/${n}.yml`), 'utf8'))
  writeFileSync(join(dir, 'files.json'), JSON.stringify(files.map((filename) => ({ filename })))); writeFileSync(join(dir, 'calls.log'), '')
  writeFileSync(join(dir, 'bin/gh'), `#!/bin/bash\necho "$*" >> "${dir}/calls.log"\n${ghFail ? `[[ "$*" == *${ghFail}* ]] && exit 1\n` : ''}exit 0\n`); chmodSync(join(dir, 'bin/gh'), 0o755)
  const r = spawnSync('bash', ['-c', `set -euo pipefail\nREPO=r\nnum=7\n: > dispatch-fail.txt\nprintf "7\\n" | while read -r _; do\n if true; then\n${block}\n fi\ndone\nif [ -s dispatch-fail.txt ]; then echo "FAIL: $(sort -u dispatch-fail.txt | tr '\\n' ' ')"; exit 1; fi\necho OK\n`], { cwd: dir, env: { PATH: `${join(dir, 'bin')}:${process.env.PATH}`, HOME: dir }, encoding: 'utf8' })
  return { status: r.status, out: r.stdout + r.stderr, calls: readFileSync(join(dir, 'calls.log'), 'utf8').split('\n').filter(Boolean).map((l) => /workflow run (\S+)/.exec(l)?.[1]) }
}
const pushOf = (body) => () => `name: x\non:\n  push:\n${body}\n`
const paths = (...p) => `    branches: [master]\n    paths:\n${p.map((x) => `      - ${x}`).join('\n')}`
// [이름, 바뀐 파일, jobcard-integrity.yml 변형, 기대 exit, 기대 호출 또는 출력 정규식]
export const BOT_CASES = [
  ['정상: 맞는 세 검사만(scripts/ocr/**는 job-ocr-check에도 맞음)', ['scripts/ocr/a/b.mjs', 'src/pages/Home.tsx'], null, 0, ['job-rules-apply.yml', 'jobcard-integrity.yml', 'job-ocr-check.yml']],
  ['11-21 추가 대상: AI 판독기 파일 → ai-reader-calibration·job-ocr-check도 호출', ['scripts/ocr/ai-reader.mjs'], null, 0, ['job-rules-apply.yml', 'ai-reader-calibration.yml', 'job-ocr-check.yml']],
  ['11-21 추가 대상: 상세 채우기 코드 → job-ocr-check만', ['src/lib/jobDetailFill.ts'], null, 0, ['job-ocr-check.yml']],
  ['무관 파일: 호출 없음', ['README.md'], null, 0, []],
  ['호출 실패: 오류 기록', ['crawler/occupation_classifier.py'], null, 1, /호출 실패/, { ghFail: 'occupation-r8-apply' }],
  ['push 없음', ['README.md'], () => 'name: x\non:\n  workflow_dispatch: {}\n', 1, /paths 목록 없음/],
  ['빈 파일', ['README.md'], () => '', 1, /paths 목록 없음/],
  ['paths 흐름식(목록으로 읽히지 않음)', ['src/a.ts'], pushOf('    branches: [master]\n    paths: [src/a.ts]'), 1, /paths 목록 없음/],
  ['paths 키 없음(조용히 호출·생략하지 않고 차단)', ['README.md'], pushOf('    branches: [master]'), 1, /paths 목록 없음/],
  ['GitHub 패턴 *: 한 칸만(src/a.ts 일치)', ['src/a.ts'], pushOf(paths('src/*.ts')), 0, ['jobcard-integrity.yml']],
  ['GitHub 패턴 *: / 넘지 않음(src/a/b.ts 불일치)', ['src/a/b.ts'], pushOf(paths('src/*.ts')), 0, []],
  ['GitHub 패턴 **: 여러 칸(src/a/b.ts 일치)', ['src/a/b.ts'], pushOf(paths('src/**')), 0, ['jobcard-integrity.yml']],
  ['점은 글자 그대로(srcXa.ts 불일치)', ['srcXa.ts'], pushOf(paths('src.a.ts')), 0, []],
  ['제외 패턴(!)', ['README.md'], pushOf(paths("'!docs/**'")), 1, /!docs/],
  ['? 패턴', ['README.md'], pushOf(paths('src/a?.ts')), 1, /\?/],
  ['+ 패턴', ['README.md'], pushOf(paths('src/a+.ts')), 1, /\+/],
  ['[] 패턴', ['README.md'], pushOf(paths('src/[ab].ts')), 1, /\[/],
  ['paths-ignore(paths 목록 아님)', ['README.md'], pushOf('    branches: [master]\n    paths-ignore:\n      - docs/**'), 1, /paths 목록 없음/],
]
export function runBotCases(W) {
  for (const [name, files, yml, status, want, opt = {}] of BOT_CASES) {
    const r = runBotBlock(W, files, { yml: yml ?? ((t) => t), ...opt }), tag = `봇 블록 '${name}'`
    assert.equal(r.status, status, `${tag}: exit ${r.status}(기대 ${status}) ${r.out}`)
    if (Array.isArray(want)) assert.deepEqual(r.calls.slice().sort(), want.slice().sort(), `${tag}: 호출 ${r.calls}`); else assert.match(r.out, want, tag)
  }
}

// ---------- vercel-deploy의 핀 검사 호출 단계: 순서·실패 전파 ----------
export function checkHub(W) {
  const steps = Object.values(W[HUB].jobs)[0].steps, i = steps.findIndex((s) => typeof s.run === 'string' && s.run.includes(`${PIN}.yml`)), f = steps.findIndex((s) => /^failure\(\)/.test(s.if ?? ''))
  // 호출 단계나 concurrency가 아예 없는 결함은 아래 시나리오(누락·중복 횟수)가 잡는다. 여기서는 있을 때의 모양만 본다.
  if (i >= 0) { assert.ok(f >= 0 && i > f, "핀 검사 호출 단계는 '실패 기록(이슈)'(failure()) 뒤에 있어야 함 — 앞이면 호출 실패가 운영 배포 실패 이슈로 잘못 기록됨"); assert.ok(!('continue-on-error' in steps[i]), '핀 검사 호출 단계에 continue-on-error 금지') }
  const c = W[PIN].concurrency ?? pinJob(W).concurrency; if (c) { assert.equal(c['cancel-in-progress'], false, '핀 검사 concurrency는 cancel-in-progress: false여야 함'); assert.match(c.group, /inputs\.sha/, 'concurrency 그룹은 커밋 sha 기준이어야 함') }
}
export function runHubStep(W, { failDispatch = false, failIssue = false, failSince = false } = {}) {
  const step = Object.values(W[HUB].jobs)[0].steps.find((s) => typeof s.run === 'string' && s.run.includes(`${PIN}.yml`))
  const dir = mkdtempSync(join(tmpdir(), 'hub-step-')); mkdirSync(join(dir, 'bin'))
  writeFileSync(join(dir, 'bin/gh'), `#!/bin/bash\necho "$*" >> "${dir}/calls.log"\nif [[ "$*" == *run_started_at* ]]; then ${failSince ? 'exit 1' : `echo ${SINCE}; exit 0`}; fi\n${failDispatch ? '[[ "$*" == *"workflow run"* ]] && exit 1\n' : ''}${failIssue ? '[[ "$*" == *"issue create"* ]] && exit 1\n' : ''}exit 0\n`); chmodSync(join(dir, 'bin/gh'), 0o755); writeFileSync(join(dir, 'calls.log'), '')
  const r = spawnSync('bash', ['-e', '-c', interp(step.run, ctxOf('workflow_dispatch'))], { cwd: dir, env: { PATH: `${join(dir, 'bin')}:${process.env.PATH}`, HOME: dir, GITHUB_SHA: SHA }, encoding: 'utf8' })
  return { status: r.status, calls: readFileSync(join(dir, 'calls.log'), 'utf8').split('\n').filter(Boolean) }
}
export function runHubCases(W) {
  if (!Object.values(W[HUB].jobs)[0].steps.some((s) => typeof s.run === 'string' && s.run.includes(`${PIN}.yml`))) return // 호출 단계가 없는 결함은 시나리오가 잡는다
  const runs = (r) => r.calls.filter((c) => c.startsWith('workflow run')), issues = (r) => r.calls.filter((c) => c.startsWith('issue create'))
  let r = runHubStep(W); assert.equal(r.status, 0, '핀 검사 호출 성공: exit 0'); assert.ok(runs(r).length === 1 && runs(r)[0].includes(`-f sha=${SHA}`) && runs(r)[0].includes(`-f since=${SINCE}`) && !issues(r).length, '핀 검사 호출은 sha와 since(이 실행의 시작 시각)를 넘겨 1번, 이슈 없음')
  r = runHubStep(W, { failDispatch: true }); assert.equal(r.status, 1, '핀 검사 호출 실패: 잡이 exit 1로 실패해야 함'); assert.ok(issues(r).length === 1, '호출 실패는 이슈로도 기록')
  r = runHubStep(W, { failSince: true }); assert.equal(r.status, 1, '시작 시각(since)을 못 읽으면: 호출하지 않고 exit 1'); assert.ok(!runs(r).length && issues(r).length === 1, 'since를 못 읽으면 핀 검사를 부르지 않고 이슈로 기록')
  r = runHubStep(W, { failDispatch: true, failIssue: true }); assert.equal(r.status, 1, '호출 실패 + 이슈 기록도 실패: 그래도 exit 1')
}

// ---------- 결함 주입 ----------
const clone = (o) => JSON.parse(JSON.stringify(o))
const pinJob = (W) => Object.values(W[PIN].jobs)[0], gateOf = (W) => pinJob(W).steps.find((s) => s.id === 'gate')
const hubSteps = (W) => Object.values(W[HUB].jobs)[0].steps, pinIdx = (W) => hubSteps(W).findIndex((s) => typeof s.run === 'string' && s.run.includes(`${PIN}.yml`))
const checkStep = (W) => pinJob(W).steps.find((s) => (s.name ?? '').startsWith('All public source points'))
const subCheck = (W, from, to) => { const c = checkStep(W); assert.ok(c.run.includes(from), `주입 전제: 검사 단계에 '${from}'가 있어야 함`); c.run = c.run.replace(from, to) }
const sub = (W, from, to) => { const g = gateOf(W); assert.ok(g.run.includes(from), `주입 전제: gate에 '${from}'가 있어야 함`); g.run = g.run.replace(from, to) }
export const MUTATIONS = [
  ['1 deploy-verify 성공 조건 제거(job if + gate)', (W) => { pinJob(W).if = "github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_run'"; sub(W, '[ "$conclusion" != success ]', 'false') }],
  ['2 핀 검사 호출 경로 제거', (W) => hubSteps(W).splice(pinIdx(W), 1)],
  ['3 핀 검사 중복 호출 추가', (W) => hubSteps(W).splice(pinIdx(W), 0, clone(hubSteps(W)[pinIdx(W)]))],
  ['4 deploy-verify 실패 상태에서 핀 검사 실행(gate가 실패 통과)', (W) => sub(W, '[ "$conclusion" != success ]', '[ -z "$conclusion" ]')],
  ['5 (추가) 같은 커밋 중복 방지 제거', (W) => sub(W, 'if [ "$skip" != 0 ]', 'if false')],
  ['6 (추가) concurrency 제거(동시 실행이 서로를 못 봄)', (W) => { delete W[PIN].concurrency; delete pinJob(W).concurrency }],
  ['7 (추가) 최신 실행 대신 과거 성공 인정', (W) => sub(W, 'sort_by(.created_at, .id) | last', 'map(select(.conclusion == "success")) | last')],
  ['8 (추가) 이전 실행이 실패여도 재실행을 막음', (W) => { sub(W, 'select(.conclusion == "success") | .id', 'select(.conclusion != null) | .id'); sub(W, '.conclusion == "success")] | length > 0', '.conclusion != null)] | length > 0') }],
  ['9 (추가) sha 없는 수동 실행이 deploy-verify 확인을 건너뜀', (W) => { const g = gateOf(W); g.run = 'if [ "$EVENT" = workflow_dispatch ] && [ -z "$INPUT_SHA" ]; then echo "go=true" >> "$GITHUB_OUTPUT"; exit 0; fi\n' + g.run }],
  ['10 (v3) 핀 검사 호출 실패를 잡 실패로 전파하지 않음(exit 1 제거)', (W) => { const s = hubSteps(W)[pinIdx(W)]; assert.ok(s.run.includes('exit 1')); s.run = s.run.replace(/ *exit 1\n/, '') }],
  ['11 (v3) 핀 검사 호출 실패의 이슈 기록 제거', (W) => { const s = hubSteps(W)[pinIdx(W)]; s.run = s.run.replace(/ *gh issue create[^\n]*\n/, '') }],
  ['12 (v3) 핀 검사 호출 단계를 실패 기록 단계 앞으로 이동', (W) => { const st = hubSteps(W), [s] = st.splice(pinIdx(W), 1); st.splice(st.findIndex((x) => /^failure\(\)/.test(x.if ?? '')), 0, s) }],
  ['13 (v3) 대상 워크플로 push에 branches-ignore 추가', (W) => { W[TARGETS[2]].on.push['branches-ignore'] = ['x'] }],
  ['14 (v3) 대상 워크플로 paths에 지원 안 하는 패턴 추가', (W) => { W[TARGETS[0]].on.push.paths.push('src/a?.ts') }],
  ['15 (v3) concurrency를 cancel-in-progress: true로 변경', (W) => { (W[PIN].concurrency ?? pinJob(W).concurrency)['cancel-in-progress'] = true }],
  ['16 (v3.1) 건너뜀 실행의 success를 실제 검사 완료로 오인', (W) => sub(W, 'startswith("All public source points")', 'startswith("")')],
  ['17 (v3.1) concurrency를 job에서 워크플로 수준으로 되돌림(건너뛰는 실행이 대기 자리를 차지)', (W) => { W[PIN].concurrency = pinJob(W).concurrency; delete pinJob(W).concurrency }],
  ['18 (P1) 검사 재시도 제거(1번만 시도)', (W) => subCheck(W, 'for attempt in 1 2', 'for attempt in 1')],
  ['19 (P1) 검사 재시도 한도 제거(8번 시도)', (W) => subCheck(W, 'for attempt in 1 2', 'for attempt in 1 2 3 4 5 6 7 8')],
  ['20 (P1) 검사가 2번 모두 실패해도 실패를 숨김(exit 0)', (W) => { const c = checkStep(W); assert.ok(/exit 1\s*$/.test(c.run)); c.run = c.run.replace(/exit 1\s*$/, 'exit 0\n') }],
  ['21 (P1) 이전 성공 기록 인정(since 이후 필터 제거)', (W) => sub(W, ' and .created_at >= $since', '')],
  ['22 (P1) workflow_run 이벤트가 과거 실행이어도 통과(최근 실행 확인 제거)', (W) => sub(W, '[ "$newest" != "$dvid" ]', 'false')],
  ['23 (P1) since 없이도 deploy-verify를 식별한 것으로 처리(식별 불가 오류 제거)', (W) => sub(W, '[ -z "$INPUT_SINCE" ]', 'false')],
  ['24 (P1) vercel-deploy가 since를 넘기지 않음', (W) => { const s = hubSteps(W)[pinIdx(W)]; assert.ok(s.run.includes(' -f since="$since"')); s.run = s.run.replace(' -f since="$since"', '') }],
  ['25 (P1) 후보가 여러 개여도 오류 없이 가장 이른 실행을 고름', (W) => sub(W, '[ "${#arr[@]}" -gt 1 ]', 'false')],
  ['26 (P1) 후보에서 이벤트 종류(workflow_dispatch) 구분 제거(push 실행도 후보)', (W) => sub(W, '.event == "workflow_dispatch" and ', '')],
  ['27 (P1) 최종 실패 기록에서 오류 원인 제거', (W) => subCheck(W, 'cause="$(tail -n 5 "$log"', 'cause="$(true "$log"')],
  ['28 (P1) 허용 직전 재조회 제거', (W) => sub(W, '[ "${#arr2[@]}" -ne 1 ] || [ "${arr2[0]}" != "$dvid" ]', 'false')],
  ['29 (P1) 재조회가 후보 개수(정확히 1개)를 보지 않음', (W) => sub(W, '[ "${#arr2[@]}" -ne 1 ] || ', '')],
  ['30 (P1) 재조회가 고정한 Run ID와의 일치를 보지 않음', (W) => sub(W, ' || [ "${arr2[0]}" != "$dvid" ]', '')],
  ['31 (P1) 재조회 실패를 기존 Run ID로 대체해 통과', (W) => sub(W, 'cands2=$(cands)', 'cands2=$(cands || echo "$dvid")')],
]
const caught = (W, apply) => { const M = clone(W); apply(M); try { runSuite(M) } catch (e) { return String(e.message).split('\n')[0] } return null }

function main() {
  const W = load(), a = process.argv.indexOf('--mutate')
  if (a >= 0) { const [name, apply] = MUTATIONS[Number(process.argv[a + 1]) - 1]; const M = clone(W); apply(M); runSuite(M); console.log(`결함 ${name}: 시험이 잡지 못함`); return }
  runSuite(W); console.log(`post-merge-chain: 시나리오 ${SCENARIOS.length}개 × 가정 2가지(A1·A2) 통과`)
  runBotCases(W); console.log(`post-merge-chain: 봇 병합기 호출 블록 ${BOT_CASES.length}개 통과`)
  for (const [name, apply] of MUTATIONS) { const why = caught(W, apply); assert.ok(why, `결함 주입 '${name}'을 시험이 잡지 못함`); console.log(`post-merge-chain: 결함 ${name} → 잡음: ${why.slice(0, 110)}`) }
  console.log('post-merge-chain.test.mjs: 통과')
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main()

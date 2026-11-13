// 필수 검사 이름(checks·guard·app-screen·publication-gate)이 PR에서 도는 워크플로 잡 중 정확히 1개씩인지 정적 검사(#728 S1).
// 이름이 같은 잡이 둘이면 한쪽(항상 초록)이 다른 쪽(빨간 검사)을 가려 필수 검사를 우회할 수 있다(approved-layout-guard의 `checks` 사례).
import { readdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

export const REQUIRED = ['checks', 'guard', 'app-screen', 'publication-gate']

/**
 * 방법 변경(Lee 2026-11-12 승인 ③, #751·#752: 같은 손 파서의 정규식 패치가 4번 반복 — 들여쓰기 칸 수·따옴표 잡 ID):
 * 들여쓰기 칸 수와 따옴표를 가정하지 않고(최상위·jobs 아래·잡 아래 첫 줄의 들여쓰기를 읽어 쓴다) 잡 이름을 읽고,
 * **해석을 확신 못 하면 조용히 0개로 넘어가지 않고 던진다**(닫힌 실패): 탭 들여쓰기·jobs 한 줄 값·잡마다 runs-on/uses가 정확히 1개가 아닌 경우·잡이 하나도 안 읽힘.
 * (YAML 라이브러리 추가는 Lee 결정 사항이라 하지 않았다. 흐름식 `{…}` 잡 정의처럼 이 방식이 못 읽는 모양은 던져서 사람이 보게 한다.)
 */
export function parseWorkflow(text) {
  const raw = text.split(/\r?\n/)
  const meaningful = raw.map((l, i) => ({ l, i })).filter(({ l }) => l.trim() && !/^\s*#/.test(l))
  if (meaningful.some(({ l }) => /^\t/.test(l) || /^ *\t/.test(l))) throw new Error('탭 들여쓰기 — 워크플로를 읽을 수 없음')
  const indentOf = (l) => l.match(/^ */)[0].length
  const base = meaningful.length ? indentOf(meaningful[0].l) : 0
  const keyOf = (l) => { const m = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+))\s*:(?:\s+(.*?))?\s*$/.exec(l); return m ? { key: m[1] ?? m[2] ?? m[3], rest: (m[4] ?? '').replace(/^#.*$/, '').replace(/\s+#.*$/, '').trim() } : null }
  const top = meaningful.filter(({ l }) => indentOf(l) === base)
  const blockOf = (idx) => { const out = []; for (let k = idx + 1; k < raw.length; k++) { const l = raw[k]; if (l.trim() && !/^\s*#/.test(l) && indentOf(l) <= base) break; out.push(l) } return out }
  const onTop = top.find(({ l }) => keyOf(l)?.key === 'on')
  let onBlock = ''
  if (onTop) onBlock = raw[onTop.i] + '\n' + blockOf(onTop.i).join('\n')
  const pr = /\bpull_request(?:_target)?\b/.test(onBlock)
  const jobsTop = top.find(({ l }) => keyOf(l)?.key === 'jobs')
  const jobs = []
  if (jobsTop) {
    if (keyOf(raw[jobsTop.i]).rest) throw new Error('jobs 값이 한 줄(흐름식) — 읽을 수 없음')
    const block = blockOf(jobsTop.i).filter((l) => l.trim() && !/^\s*#/.test(l))
    if (!block.length) throw new Error('jobs 아래에 잡이 없음')
    const jobIndent = indentOf(block[0])
    if (jobIndent <= base) throw new Error('jobs 아래 들여쓰기를 읽을 수 없음')
    let cur = null
    for (const l of block) {
      const ind = indentOf(l)
      if (ind === jobIndent) {
        const k = keyOf(l)
        if (!k) throw new Error('잡 줄을 읽을 수 없음: ' + l.trim().slice(0, 40))
        if (k.rest) throw new Error(`잡 '${k.key}'이 흐름식(한 줄) 정의 — 읽을 수 없음`)
        cur = { id: k.key, name: k.key, kids: [], childIndent: null }
        jobs.push(cur)
      } else if (ind > jobIndent && cur) {
        if (cur.childIndent === null) cur.childIndent = ind
        if (ind === cur.childIndent) cur.kids.push(keyOf(l))
      } else if (ind < jobIndent) throw new Error('jobs 아래 들여쓰기가 일정하지 않음')
    }
    for (const j of jobs) {
      const runs = j.kids.filter((k) => k && (k.key === 'runs-on' || k.key === 'uses')).length
      if (runs !== 1) throw new Error(`잡 '${j.id}'에 runs-on/uses가 ${runs}개 — 읽은 구조를 믿을 수 없음`)
      const nm = j.kids.find((k) => k?.key === 'name')
      if (nm) j.name = nm.rest.replace(/^(['"])(.*)\1$/, '$2')
    }
    if (!jobs.length) throw new Error('잡이 하나도 읽히지 않음')
  }
  return { pr, jobs: jobs.map(({ id, name }) => ({ id, name })) }
}

const wf = (name, on, jobs) => `name: ${name}\non:\n${on}\njobs:\n${jobs}\n`
// 자체 시험: 충돌 감지가 실제로 작동하는지
{
  const a = parseWorkflow(wf('A', '  pull_request:', '  checks:\n    runs-on: x\n'))
  const b = parseWorkflow(wf('B', '  pull_request_target:\n    types: [opened]', '  other:\n    name: checks\n    runs-on: x\n'))
  const c = parseWorkflow(wf('C', '  push:\n    branches: [master]', '  guard:\n    runs-on: x\n'))
  assert.equal(a.pr, true); assert.equal(b.pr, true); assert.equal(c.pr, false, '푸시 전용 워크플로는 PR 후보가 아님')
  assert.deepEqual(a.jobs.map((j) => j.name), ['checks'])
  assert.deepEqual(b.jobs.map((j) => j.name), ['checks'], 'name: 이 있으면 잡 id가 아니라 name 사용')
  const count = (list, n) => list.filter((w) => w.pr).flatMap((w) => w.jobs).filter((j) => j.name === n).length
  assert.equal(count([a, b, c], 'checks'), 2, '합성 충돌(잡 2개)을 감지')
  assert.equal(count([a, c], 'guard'), 0, 'PR 트리거 없는 같은 이름은 세지 않음')
}
// 시험(Lee 승인 ③, GPT 재현 반례 + Codex가 지적한 따옴표 ID): 들여쓰기 칸 수·따옴표가 달라도 같은 이름 충돌을 잡고, 못 읽는 모양은 던진다
{
  const wf4 = (jobs) => `name: X\non:\n    pull_request:\njobs:\n${jobs}`
  const four = parseWorkflow(wf4('    checks:\n        runs-on: x\n    other:\n        name: checks\n        runs-on: x\n'))
  assert.deepEqual(four.jobs.map((j) => j.name), ['checks', 'checks'], '4칸·8칸 들여쓰기에서도 같은 이름 2개를 읽음(GPT 반례)')
  assert.equal(four.pr, true)
  const quoted = parseWorkflow(wf4('  "checks":\n    runs-on: x\n  \'guard\':\n    name: "app-screen"\n    runs-on: x\n'))
  assert.deepEqual(quoted.jobs.map((j) => j.name), ['checks', 'app-screen'], '따옴표 잡 ID·따옴표 name을 읽음(#751 Codex 반례)')
  assert.deepEqual(parseWorkflow('on: [pull_request]\njobs:\n  a: # 주석\n    runs-on: x\n').jobs.map((j) => j.id), ['a'], '잡 줄 뒤 주석')
  for (const [why, text] of [
    ['탭 들여쓰기', 'on: push\njobs:\n\ta:\n\t\truns-on: x\n'],
    ['jobs 한 줄 값', 'on: push\njobs: {a: {runs-on: x}}\n'],
    ['흐름식 잡', 'on: push\njobs:\n  a: {runs-on: x}\n'],
    ['runs-on 없음', 'on: push\njobs:\n  a:\n    steps: []\n'],
    ['잡 없음', 'on: push\njobs:\n'],
  ]) assert.throws(() => parseWorkflow(text), undefined, `${why}은(는) 조용히 넘어가지 않고 던짐`)
}
// 실제 저장소 검사
const dir = new URL('../../.github/workflows/', import.meta.url)
const all = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ f, ...parseWorkflow(readFileSync(new URL(f, dir), 'utf8')) }))
for (const name of REQUIRED) {
  const owners = all.filter((w) => w.pr).flatMap((w) => w.jobs.filter((j) => j.name === name).map(() => w.f))
  assert.equal(owners.length, 1, `필수 검사 이름 '${name}'은 PR에서 도는 워크플로 잡 정확히 1개여야 함 (지금 ${owners.length}개: ${owners.join(', ') || '없음'})`)
}
console.log('required-check-names.test.mjs: 필수 검사 이름 4개가 각각 PR 워크플로 잡 1개씩(이름 충돌 없음)')

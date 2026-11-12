// 필수 검사 이름(checks·guard·app-screen·publication-gate)이 PR에서 도는 워크플로 잡 중 정확히 1개씩인지 정적 검사(#728 S1).
// 이름이 같은 잡이 둘이면 한쪽(항상 초록)이 다른 쪽(빨간 검사)을 가려 필수 검사를 우회할 수 있다(approved-layout-guard의 `checks` 사례).
import { readdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

export const REQUIRED = ['checks', 'guard', 'app-screen', 'publication-gate']

/** 가벼운 워크플로 파서(YAML 라이브러리 없이): PR 트리거 여부와 잡 이름 목록. */
export function parseWorkflow(text) {
  const lines = text.split(/\r?\n/)
  const onIdx = lines.findIndex((l) => /^on\s*:/.test(l) || /^"on"\s*:/.test(l))
  let onBlock = ''
  if (onIdx >= 0) {
    onBlock = lines[onIdx]
    for (let i = onIdx + 1; i < lines.length && (/^\s/.test(lines[i]) || lines[i] === ''); i++) onBlock += '\n' + lines[i]
  }
  const pr = /\bpull_request(?:_target)?\b/.test(onBlock)
  const jobsIdx = lines.findIndex((l) => /^jobs\s*:/.test(l))
  const jobs = []
  if (jobsIdx >= 0) {
    let cur = null
    let jobIndent = null
    for (let i = jobsIdx + 1; i < lines.length; i++) {
      const l = lines[i]
      if (/^\S/.test(l)) break
      if (!l.trim() || /^\s*#/.test(l)) continue
      const indent = l.match(/^ */)[0].length
      const id = /^\s+([A-Za-z0-9_-]+)\s*:\s*(?:#.*)?$/.exec(l)
      if (id && (jobIndent === null || indent === jobIndent)) {
        jobIndent ??= indent
        cur = { id: id[1], name: id[1] }
        jobs.push(cur)
        continue
      }
      const nm = /^\s+name\s*:\s*(.+?)\s*$/.exec(l)
      if (nm && cur && indent > jobIndent) cur.name = nm[1].replace(/^['"]|['"]$/g, '')
    }
  }
  return { pr, jobs }
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
// 회귀: 유효한 YAML은 잡 들여쓰기가 2칸으로 고정되지 않는다.
{
  const indented = parseWorkflow(wf('Indented', '  pull_request:', '    checks:\n        runs-on: ubuntu-latest\n    other:\n        name: checks\n        runs-on: ubuntu-latest'))
  assert.deepEqual(indented.jobs.map((j) => j.name), ['checks', 'checks'], '4칸 들여쓰기에서도 이름 충돌을 놓치지 않음')
}
// 실제 저장소 검사
const dir = new URL('../../.github/workflows/', import.meta.url)
const all = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ f, ...parseWorkflow(readFileSync(new URL(f, dir), 'utf8')) }))
for (const name of REQUIRED) {
  const owners = all.filter((w) => w.pr).flatMap((w) => w.jobs.filter((j) => j.name === name).map(() => w.f))
  assert.equal(owners.length, 1, `필수 검사 이름 '${name}'은 PR에서 도는 워크플로 잡 정확히 1개여야 함 (지금 ${owners.length}개: ${owners.join(', ') || '없음'})`)
}
console.log('required-check-names.test.mjs: 필수 검사 이름 4개가 각각 PR 워크플로 잡 1개씩(이름 충돌 없음)')

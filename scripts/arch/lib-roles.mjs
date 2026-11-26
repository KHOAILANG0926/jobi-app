// src/lib 역할 분류표 생성기(구조 정리 2번). 실제 import 그래프에서 파일마다 역할을 읽어 마크다운으로 출력한다.
// 실행: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/arch/lib-roles.mjs > docs/architecture/lib-roles.md
// 이 분류표는 읽는 사람을 위한 스냅샷이다. 시험이 지키는 것은 규칙(src/archtest/layers.test.ts)이며 표 자체는 시험하지 않는다 — 새 파일이 생겨도 표 때문에 실패하지 않는다.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { findImpureClosure, impurityOf, isSource, nodeRunStarts, resolveImport, valueImports } from '../../src/archtest/importGraph.ts'

const root = new URL('../../', import.meta.url)
const files = new Map()
const walk = (rel) => {
  for (const e of readdirSync(new URL(rel + '/', root), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = rel + '/' + e.name
    if (e.isDirectory()) walk(p)
    else files.set(p, isSource(p) ? readFileSync(new URL(p, root), 'utf8') : '')
  }
}
for (const d of ['src', 'api', 'scripts', 'ops']) if (existsSync(new URL(d + '/', root))) walk(d)

const lib = [...files.keys()].filter((p) => /^src\/lib\/[^/]+\.(ts|tsx|mjs)$/.test(p) && !/\.test\./.test(p)).sort()

// 어떤 시작점들에서 닿는 src 파일 집합(실행 코드 가져오기 따라가기)
function reach(starts) {
  const seen = new Set(starts)
  const q = [...starts]
  while (q.length) {
    const c = q.shift()
    const src = files.get(c)
    if (src === undefined || !isSource(c)) continue
    for (const s of valueImports(src)) {
      const t = resolveImport(files, c, s)
      if (t && t.startsWith('src/') && !seen.has(t)) { seen.add(t); q.push(t) }
    }
  }
  return seen
}
const inDir = (d) => [...files.keys()].filter((p) => p.startsWith(d) && isSource(p) && !/\.test\./.test(p))
const webStarts = ['src/App.tsx', 'src/main.tsx', 'src/entry-server.tsx', ...inDir('src/pages/'), ...inDir('src/components/'), ...inDir('src/context/')].filter((p) => files.has(p))
const appStarts = inDir('src/app/')
const web = reach(webStarts)
const app = reach(appStarts)
const api = reach([...new Set(nodeRunStarts(files, ['api/']).map((s) => s.to))])
const node = reach([...new Set(nodeRunStarts(files, ['scripts/', 'ops/']).map((s) => s.to))])

const rows = lib.map((p) => {
  const own = impurityOf(files, p)
  const closure = findImpureClosure(files, [p])
  const usedBy = [web.has(p) && '웹', app.has(p) && '앱', api.has(p) && '서버(api)', node.has(p) && 'Node 도구'].filter(Boolean)
  let role
  const touchesSupabase = own.some((r) => r.includes('Supabase'))
  const touchesBrowser = own.some((r) => r.includes('브라우저 전역'))
  if (touchesSupabase) role = '데이터 접근(브라우저 Supabase 직접)'
  else if (touchesBrowser || own.some((r) => r === 'react')) role = '브라우저 의존(저장·이벤트·React)'
  else if (closure.length) role = '간접 의존(끌어오는 파일이 브라우저 의존)'
  else if (api.has(p) || node.has(p)) role = '엔진(서버·Node에서 쓰임, 순수)'
  else role = '순수(서버 사용 증거 없음)'
  return { p, role, usedBy, own, via: closure.filter((c) => c.file !== p).map((c) => c.file) }
})

const count = (f) => rows.filter(f).length
const order = ['엔진(서버·Node에서 쓰임, 순수)', '순수(서버 사용 증거 없음)', '간접 의존(끌어오는 파일이 브라우저 의존)', '브라우저 의존(저장·이벤트·React)', '데이터 접근(브라우저 Supabase 직접)']
const out = []
out.push('# src/lib 역할 분류표 (스냅샷)')
out.push('')
out.push('생성: `node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/arch/lib-roles.mjs > docs/architecture/lib-roles.md`')
out.push('실제 import 그래프에서 읽은 값이며 손으로 고치지 않는다. 시험이 지키는 것은 표가 아니라 규칙(`src/archtest/layers.test.ts`)이다.')
out.push('')
out.push('## 규칙 요약')
out.push('- R1·R2: 서버 함수(`api/`)와 Node 도구(`scripts/`·`ops/`)가 끌어오는 `src` 코드는 React·브라우저 전역·브라우저 Supabase 클라이언트·화면 코드·css를 만지면 안 된다(알려진 빚만 `layers.test.ts`의 KNOWN에 이유와 함께 허용).')
out.push('- R3·R4: `src/lib`·`data`·`types`·`context`는 화면 코드(`components`·`pages`·`app`)를 가져오지 않는다(타입 포함, 알려진 1건).')
out.push('- R5: `src/types`는 값을 가져오지 않는다.')
out.push('- 앱↔웹: 앱은 웹 화면 코드를 가져오지 않고 웹은 `src/app`을 가져오지 않는다(`src/app/boundary.test.ts`).')
out.push('')
out.push(`## 합계 (src/lib 파일 ${rows.length}개)`)
for (const r of order) out.push(`- ${r}: ${count((x) => x.role === r)}개`)
out.push(`- 웹과 앱이 함께 쓰는 파일: ${count((x) => x.usedBy.includes('웹') && x.usedBy.includes('앱'))}개 · 웹만: ${count((x) => x.usedBy.includes('웹') && !x.usedBy.includes('앱'))}개 · 앱만: ${count((x) => x.usedBy.includes('앱') && !x.usedBy.includes('웹'))}개 · 서버(api)가 쓰는 파일: ${count((x) => x.usedBy.includes('서버(api)'))}개`)
out.push('')
for (const r of order) {
  const list = rows.filter((x) => x.role === r)
  if (!list.length) continue
  out.push(`## ${r} — ${list.length}개`)
  out.push('')
  out.push('| 파일 | 쓰는 곳 | 비고 |')
  out.push('|---|---|---|')
  for (const x of list) out.push(`| \`${x.p.replace('src/lib/', '')}\` | ${x.usedBy.join('·') || '(가져오는 곳 없음)'} | ${x.own.join(', ') || (x.via.length ? '끌어옴: ' + x.via.slice(0, 2).map((v) => v.replace('src/', '')).join(', ') : '')} |`)
  out.push('')
}
console.log(out.join('\n'))

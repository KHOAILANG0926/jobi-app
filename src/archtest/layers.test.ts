// 계층 규칙 시험(구조 정리 2번, 대표 지시 2026-11-25): 웹·앱·서버·크롤링이 함께 쓰는 src 코드가 서로 의도하지 않은 방향으로 얽히지 않게 막는다.
// 목록을 손으로 관리하지 않고 실제 import 그래프에서 규칙을 읽는다(새 파일이 생겨도 따로 등록할 필요 없음).
//  R1) 서버 함수(api/)가 끌어오는 src 코드는 React·브라우저 전역·Supabase 브라우저 클라이언트·화면 코드·css를 만지면 안 된다
//      (2026-10-20 서버 함수가 시작부터 FUNCTION_INVOCATION_FAILED로 죽은 사고의 재발 방지). 지금 이미 있는 위반은 아래 KNOWN에 이유와 함께 적어 두고, 새 위반만 막는다.
//  R2) Node로 돌리는 도구(scripts·ops)가 끌어오는 src 코드도 같은 규칙. 화면을 직접 돌리는 시험 도구는 KNOWN에 적는다.
//  R3) src/lib·src/data·src/types는 화면 코드(components·pages·app)를 가져오지 않는다(타입 가져오기 포함, 지금 1건 KNOWN).
//  R4) src/context는 화면 코드(components·pages·app)를 가져오지 않는다.
//  R5) src/types는 아무것도 실행하지 않는 타입 모음이라 값 가져오기를 하지 않는다.
// 앱↔웹 방향 규칙은 src/app/boundary.test.ts가 맡는다. 두 시험은 같은 가져오기 읽기 도구(importGraph.ts)를 쓴다.
import { allImports, findImpureClosure, impurityOf, isSource, nodeRunStarts, resolveImport, valueImports, type Files } from './importGraph'

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error('FAIL: ' + m)
}

// ---- 지금 있는 위반(알려진 빚). 새로 생기는 위반만 실패시킨다. 고치면 여기서 지운다. -------------------------------------
// 키 = 순수하지 않은 src 파일, 값 = 왜 아직 허용하는지.
const KNOWN_API: Record<string, string> = {
  'src/lib/adminVietmapClient.ts': '서버 위치 확인 묶음(autoLocationResolver → chototAutoLocate)이 관리자 화면용 VietMap 호출 함수를 끌어옴 — 그 함수는 브라우저 로그인 세션(supabase.auth)을 읽는다. 서버 쪽 호출과 갈라야 함(위치 처리 작업 창과 순서 조정 뒤).',
  'src/lib/recommendStorage.ts': '서버 위치 확인 묶음(autoLocationResolver → mapR1 → homeMapFilters)이 맞춤 조건 저장소(localStorage)가 든 파일을 끌어옴 — 순수 계산(급여 읽기·조건 판정)과 브라우저 저장을 갈라야 함(구조 정리 3~4번 대상).',
}
const KNOWN_NODE: Record<string, string> = {
  'src/components/home/SearchRadiusInput.tsx': '화면 부품을 Node에서 직접 그려 보는 시험용 도구(scripts/fixtures/search-radius-commit.tsx) — 화면 시험 도구라 React가 필요함.',
  'src/components/home/map/vietMapStyle.ts': '지도 스타일 복사 확인 도구(scripts/ops/vietmap-style-copy.mjs)가 웹 지도 스타일 파일을 직접 읽음 — 브라우저 전역 사용 줄이 있어 갈라야 함(웹 지도 작업과 순서 조정).',
  'src/lib/recommendStorage.ts': '급여 읽기 도구(scripts/ocr/salary-fill.mjs)가 순수 함수 parseSalaryInfo를 쓰려고 맞춤 조건 저장소(localStorage) 파일 전체를 가져옴 — 순수 계산과 저장을 갈라야 함(구조 정리 3~4번 대상).',
  'src/lib/adminVietmapClient.ts': 'KNOWN_API와 같은 이유(서버 위치 확인 묶음이 끌어옴, 이 묶음을 쓰는 Node 도구도 같이 걸림).',
}
// R3 예외: [가져오는 파일, 가져오는 대상]
const KNOWN_LIB_TO_UI: Array<[string, string]> = [['src/lib/mapR1.ts', 'src/components/home/map/HomeMapTypes.ts']]

// ---- 자체 시험(가짜 파일로 검사기가 실제로 실패를 잡는지) ------------------------------------------------
const fx = (e: Record<string, string>): Files => new Map(Object.entries(e))
{
  const ok = fx({
    'api/a.js': "import { f } from '../src/lib/f.ts'\nimport { d } from '../src/data/d.ts'\n",
    'src/lib/f.ts': "import { d } from '../data/d'\nimport type { T } from '../types/t'\nexport const f = (x: number) => x + d // window 변수명 아님 주석 window.x\nconst window = 3\n",
    'src/data/d.ts': 'export const d = 1',
    'src/types/t.ts': 'export type T = {}',
  })
  assert(findImpureClosure(ok, ['src/lib/f.ts', 'src/data/d.ts']).length === 0, '순수한 코드(주석·변수 이름 window 포함)는 통과해야 함')
  const bad: Array<[string, Record<string, string>, string]> = [
    ['react', { 'src/lib/f.ts': "import { useState } from 'react'\nexport const f = useState" }, 'react'],
    ['window 속성', { 'src/lib/f.ts': 'export const f = () => window.location.href' }, '브라우저 전역'],
    ['localStorage', { 'src/lib/f.ts': "export const f = () => localStorage.getItem('a')" }, '브라우저 전역'],
    ['이벤트 만들기', { 'src/lib/f.ts': "export const f = () => new CustomEvent('x')" }, '브라우저 전역'],
    ['브라우저 Supabase 클라이언트', { 'src/lib/f.ts': "import { supabase } from './supabase'\nexport const f = supabase", 'src/lib/supabase.ts': 'export const supabase = 1' }, 'src/lib/supabase.ts'],
    ['화면 코드', { 'src/lib/f.ts': "import C from '../components/C'\nexport const f = C", 'src/components/C.tsx': '' }, '화면 코드'],
    ['css', { 'src/lib/f.ts': "import './f.css'", 'src/lib/f.css': '' }, 'css'],
  ]
  for (const [name, entries, why] of bad) {
    const files = fx(entries)
    const hits = findImpureClosure(files, ['src/lib/f.ts'])
    assert(hits.some((h) => h.file === 'src/lib/f.ts' && h.reasons.join().includes(why)), `${name}: 위반을 잡아야 함 (결과: ${JSON.stringify(hits)})`)
  }
  const chain = findImpureClosure(fx({ 'src/lib/a.ts': "import { b } from './b'\nexport const a = b", 'src/lib/b.ts': "import { c } from './c'\nexport const b = c", 'src/lib/c.ts': 'export const c = document.title' }), ['src/lib/a.ts'])
  assert(chain.length === 1 && chain[0].chain.join('>') === 'src/lib/a.ts>src/lib/b.ts>src/lib/c.ts', '가져오기 사슬을 따라가며 위반 파일과 경로를 알려야 함: ' + JSON.stringify(chain))
  const typeOnly = fx({ 'src/lib/f.ts': "import type { C } from '../components/C'\nexport type X = C", 'src/components/C.tsx': 'export type C = {}' })
  assert(impurityOf(typeOnly, 'src/lib/f.ts').length === 0, '타입만 가져오는 것은 순수성 위반이 아님(R3이 따로 봄)')
  const starts = nodeRunStarts(fx({ 'api/a.js': "import { f } from '../src/lib/f.ts'", 'api/a.test.js': "import { f } from '../src/lib/g.ts'", 'scripts/s.mjs': "import { f } from '../src/lib/h.ts'", 'src/lib/f.ts': '', 'src/lib/g.ts': '', 'src/lib/h.ts': '' }), ['api/'])
  assert(starts.length === 1 && starts[0].to === 'src/lib/f.ts', 'api의 시험 파일·다른 폴더는 시작점이 아님')
}

// ---- 실제 저장소 검사 ----------------------------------------------------------------------------------
type Fs = {
  readFileSync(p: URL, enc: string): string
  readdirSync(p: URL, o: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>
  existsSync(p: URL): boolean
}
const fsModule = 'node:fs'
const fs = (await import(/* @vite-ignore */ fsModule)) as Fs
const root = new URL('../../', import.meta.url)

function load(dirs: string[]): Files {
  const files: Files = new Map()
  const walk = (rel: string) => {
    for (const e of fs.readdirSync(new URL(rel + '/', root), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const p = rel + '/' + e.name
      if (e.isDirectory()) walk(p)
      else files.set(p, isSource(p) || p.endsWith('.css') ? fs.readFileSync(new URL(p, root), 'utf8') : '')
    }
  }
  for (const d of dirs) if (fs.existsSync(new URL(d + '/', root))) walk(d)
  return files
}
const files = load(['src', 'api', 'scripts', 'ops'])
assert(files.has('src/lib/jobIdentity.ts') && files.has('src/app/main.tsx'), '저장소 파일을 읽지 못함')

function checkNodeRun(label: string, dirs: string[], known: Record<string, string>) {
  const starts = nodeRunStarts(files, dirs)
  assert(starts.length > 3, `${label}: src를 가져오는 진입점을 찾지 못함(폴더 이름이 바뀌었나?)`)
  const bad = findImpureClosure(files, [...new Set(starts.map((s) => s.to))]).filter((h) => !(h.file in known))
  assert(bad.length === 0, `${label}가 끌어오는 src 코드가 서버·Node에서 못 쓰는 것을 만짐 — 해당 파일을 고치거나, 불가피하면 KNOWN에 이유와 함께 적는다:\n  ` +
    bad.map((h) => `${h.file} [${h.reasons.join(', ')}]  ← ${h.chain.join(' → ')}`).join('\n  '))
}
checkNodeRun('서버 함수(api/)', ['api/'], KNOWN_API)
checkNodeRun('Node 도구(scripts·ops)', ['scripts/', 'ops/'], KNOWN_NODE)

// R3·R4·R5 — 아래쪽 계층이 위쪽(화면)을 가져오지 않는다
const isKnownLibToUi = (from: string, to: string) => KNOWN_LIB_TO_UI.some(([f, t]) => f === from && t === to)
const up: string[] = []
for (const [p, src] of files) {
  if (!isSource(p) || /\.test\.[cm]?[jt]sx?$/.test(p)) continue
  const low = p.startsWith('src/lib/') || p.startsWith('src/data/') || p.startsWith('src/types/')
  const ctx = p.startsWith('src/context/')
  if (!low && !ctx) continue
  for (const spec of allImports(src)) {
    const to = resolveImport(files, p, spec)
    if (!to) continue
    if (/^src\/(?:components|pages|app)\//.test(to) && !isKnownLibToUi(p, to)) up.push(`${p} → ${to}`)
  }
}
assert(up.length === 0, 'src/lib·data·types·context가 화면 코드(components·pages·app)를 가져옴(아래 계층이 위 계층을 가져오면 안 됨):\n  ' + up.join('\n  '))

const typeValue: string[] = []
for (const [p, src] of files) {
  if (!p.startsWith('src/types/') || !isSource(p)) continue
  for (const spec of valueImports(src)) typeValue.push(`${p} → ${spec}`)
}
assert(typeValue.length === 0, 'src/types는 값을 가져오면 안 됨(타입 모음):\n  ' + typeValue.join('\n  '))

// KNOWN 예외가 아직 실제로 있는지(고친 뒤 목록에 남아 있으면 알려 준다) — 계층 예외만 확인한다. 순수성 KNOWN은 새 위반만 막는 용도라 따로 확인하지 않는다.
for (const [f, t] of KNOWN_LIB_TO_UI) {
  const src = files.get(f)
  assert(src !== undefined && allImports(src).some((s) => resolveImport(files, f, s) === t), `KNOWN_LIB_TO_UI의 ${f} → ${t} 는 이제 없음 — 목록에서 지운다`)
}

console.log('layers.test.ts: all assertions passed')

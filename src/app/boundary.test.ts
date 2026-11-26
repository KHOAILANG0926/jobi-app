// 앱(src/app)과 웹 화면 코드가 섞이지 않게 하는 경계 검사(대표 결정 2026-11-25, 설계안 '자동 검사').
// scripts/run-tests.mjs가 src/**/*.test.ts를 자동으로 돌리므로 이 파일만 두면 되고 run-tests.mjs는 고치지 않는다.
//  1) 앱이 웹 화면 코드를 가져다 쓰면 실패 — src/pages, 지도 외 src/components, index.css·웹 입구(App/main/entry-server), 웹 css.
//     앱 파일에서 직접 가져오는 것만이 아니라 lib·context 등을 거쳐 끌려오는 것까지(가져오기 사슬) 본다.
//  2) 지도 허용 목록(HomeMapCanvas·JobVietMap·components/home/map/**) 자체가 웹 화면 코드에 기대지 않는지 본다.
//  3) 웹(src/app 밖)이 src/app을 가져오면 실패(타입 가져오기 포함).
//  4) 앱 입구(app.html)·스타일(app.css 클래스 app-)·파일 이름(auth·rls 금지)·하단 탭 수·배포 규칙 확인.
// 타입만 가져오는 것(import type / { type A })은 실행 코드가 아니므로 허용한다.

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error('FAIL: ' + m)
}
import { allImports, isSource, isTest, resolveImport, valueImports, type Edge, type Files } from '../archtest/importGraph'
export { allImports, resolveImport, valueImports }

// ---- 구역 ---------------------------------------------------------------------------------
const WEB_ENTRIES = ['src/App.tsx', 'src/main.tsx', 'src/entry-server.tsx', 'src/index.css']
// 앱이 가져다 써도 되는 웹 쪽 지도 부품(대표 결정 2026-11-25). HomeMapExplorer는 웹 부품을 써서 허용하지 않는다.
const MAP_ALLOWED_PREFIX = ['src/components/home/map/']
const MAP_ALLOWED_FILES = ['src/components/home/HomeMapCanvas.tsx', 'src/components/JobVietMap.tsx']
export const isMapAllowed = (p: string) => MAP_ALLOWED_FILES.includes(p) || MAP_ALLOWED_PREFIX.some((x) => p.startsWith(x))
export const isApp = (p: string) => p.startsWith('src/app/')
// 앱이 끌어오면 안 되는 웹 화면 코드
export function isForbiddenForApp(p: string): boolean {
  if (isApp(p)) return false
  if (WEB_ENTRIES.includes(p)) return true
  if (p.startsWith('src/pages/')) return true
  if (p.startsWith('src/components/')) return !isMapAllowed(p)
  if (p.endsWith('.css')) return true // 앱 밖 모든 css(웹 공통 스타일 포함). 지도 스타일은 src/app/map.css로 복사한다.
  return false
}

// 시작 파일들에서 실행 코드 가져오기를 따라가며, 금지 구역에 닿는 가져오기 사슬을 모두 찾는다.
export function findForbiddenChains(files: Files, roots: string[]): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const parent = new Map<string, string>()
  const queue = [...roots]
  for (const r of roots) seen.add(r)
  while (queue.length) {
    const cur = queue.shift()!
    const src = files.get(cur)
    if (src === undefined || !isSource(cur)) continue
    for (const spec of valueImports(src)) {
      const to = resolveImport(files, cur, spec)
      if (!to) continue
      if (isForbiddenForApp(to)) {
        const chain = [to, cur]
        for (let p = parent.get(cur); p; p = parent.get(p)) chain.push(p)
        found.push(chain.reverse().join(' → '))
        continue // 금지 구역 안은 더 따라가지 않는다
      }
      if (!seen.has(to)) { seen.add(to); parent.set(to, cur); queue.push(to) }
    }
  }
  return found
}

// 웹(src/app 밖)이 src/app을 가져오는 곳(타입 가져오기 포함)
export function findWebImportsOfApp(files: Files): Edge[] {
  const out: Edge[] = []
  for (const [p, src] of files) {
    if (isApp(p) || !isSource(p)) continue
    for (const spec of allImports(src)) {
      const to = resolveImport(files, p, spec)
      if (to && isApp(to)) out.push({ from: p, to })
    }
  }
  return out
}

// ---- 스타일·입구 규칙 ----------------------------------------------------------------------
export function nonPrefixedClasses(css: string, prefix = 'app-'): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const bad = new Set<string>()
  for (const m of text.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].trim()
    if (prelude.startsWith('@')) continue
    for (const c of prelude.matchAll(/\.([A-Za-z_][\w-]*)/g)) if (!c[1].startsWith(prefix)) bad.add(c[1])
  }
  return [...bad]
}
// 이 경로에 auth·rls가 들어가면 approval-gate가 STRICT 보안 경로로 보고 대표 승인을 요구한다(scripts/decision-approval-gate.mjs STRICT_PATHS).
export const strictNameHits = (paths: string[]) => paths.filter((p) => /auth|rls/i.test(p))

// ---- 자체 시험(가짜 파일로 검사기가 실제로 실패를 잡는지) ------------------------------------------
function fx(entries: Record<string, string>): Files {
  return new Map(Object.entries(entries))
}
{
  const ok = fx({
    'src/app/main.tsx': "import React from 'react'\nimport Root from './Root'\nimport './app.css'\nimport type { Job } from '../types/job'\nimport { useJobs } from '../context/JobsContext'\n",
    'src/app/Root.tsx': "import { Canvas } from '../components/home/HomeMapCanvas'\nimport Pin from '../components/home/map/Pin'\nexport default Canvas\n",
    'src/app/app.css': '.app-a{}',
    'src/types/job.ts': 'export type Job = {}',
    'src/context/JobsContext.tsx': "import { rows } from '../lib/rows'\nimport type { Foo } from '../components/Foo'\nexport const useJobs = () => rows",
    'src/lib/rows.ts': "export const rows = []\nexport type { Foo } from '../components/Foo'",
    'src/components/Foo.tsx': 'export type Foo = {}',
    'src/components/home/HomeMapCanvas.tsx': "import { T } from './map/HomeMapTypes'\nexport const Canvas = T",
    'src/components/home/map/HomeMapTypes.ts': 'export const T = 1',
    'src/components/home/map/Pin.ts': "import { T } from './HomeMapTypes'\nexport default T",
  })
  const roots = [...ok.keys()].filter((p) => isApp(p) && isSource(p))
  assert(findForbiddenChains(ok, roots).length === 0, '정상 앱(타입 가져오기·허용 지도·lib·context)은 통과해야 함')
  assert(findWebImportsOfApp(ok).length === 0, '정상 구조에서 웹→앱 가져오기는 없어야 함')

  const cases: Array<[string, Record<string, string>, string]> = [
    ['pages 가져오기', { 'src/app/a.tsx': "import X from '../pages/Home'", 'src/pages/Home.tsx': '' }, 'src/pages/Home.tsx'],
    ['여러 줄 가져오기', { 'src/app/a.tsx': "import {\n  A,\n  B,\n} from '../pages/Home'", 'src/pages/Home.tsx': '' }, 'src/pages/Home.tsx'],
    ['지도 밖 components', { 'src/app/a.tsx': "import S from '../components/SalaryText'", 'src/components/SalaryText.tsx': '' }, 'src/components/SalaryText.tsx'],
    ['HomeMapExplorer는 허용 안 함', { 'src/app/a.tsx': "import E from '../components/home/HomeMapExplorer'", 'src/components/home/HomeMapExplorer.tsx': '' }, 'src/components/home/HomeMapExplorer.tsx'],
    ['index.css', { 'src/app/a.tsx': "import '../index.css'", 'src/index.css': '' }, 'src/index.css'],
    ['웹 css', { 'src/app/a.tsx': "import '../components/apply.css'", 'src/components/apply.css': '' }, 'src/components/apply.css'],
    ['웹 입구', { 'src/app/a.tsx': "import App from '../App'", 'src/App.tsx': '' }, 'src/App.tsx'],
    ['동적 가져오기', { 'src/app/a.tsx': "const m = import('../pages/Home')", 'src/pages/Home.tsx': '' }, 'src/pages/Home.tsx'],
    ['export from', { 'src/app/a.ts': "export { X } from '../pages/Home'", 'src/pages/Home.tsx': '' }, 'src/pages/Home.tsx'],
    ['타입+값 섞인 가져오기', { 'src/app/a.tsx': "import { type A, B } from '../pages/Home'", 'src/pages/Home.tsx': '' }, 'src/pages/Home.tsx'],
    ['lib을 거쳐 끌려오는 경우', { 'src/app/a.tsx': "import { f } from '../lib/f'", 'src/lib/f.ts': "import S from '../components/SalaryText'\nexport const f = S", 'src/components/SalaryText.tsx': '' }, 'src/app/a.tsx → src/lib/f.ts → src/components/SalaryText.tsx'],
    ['허용된 지도 부품이 웹 부품에 기댐', { 'src/app/a.tsx': "import M from '../components/JobVietMap'", 'src/components/JobVietMap.tsx': "import S from './SalaryText'", 'src/components/SalaryText.tsx': '' }, 'src/components/JobVietMap.tsx → src/components/SalaryText.tsx'],
  ]
  for (const [name, entries, expect] of cases) {
    const files = fx(entries)
    const roots2 = [...files.keys()].filter((p) => isApp(p) && isSource(p))
    const hits = findForbiddenChains(files, roots2)
    assert(hits.some((h) => h.includes(expect)), `${name}: 위반을 잡아야 함 (결과: ${JSON.stringify(hits)})`)
  }
  const typeOnly = fx({
    'src/app/a.tsx': "import type { A } from '../pages/Home'\nimport { type B, type C } from '../pages/Home'\nexport type { D } from '../pages/Home'",
    'src/pages/Home.tsx': '',
  })
  assert(findForbiddenChains(typeOnly, ['src/app/a.tsx']).length === 0, '타입만 가져오기는 허용')

  const rev = fx({ 'src/lib/x.ts': "import type { T } from '../app/tabs'", 'src/pages/P.tsx': "import R from '../app/AppRoot'", 'src/app/tabs.ts': '', 'src/app/AppRoot.tsx': '' })
  const revHits = findWebImportsOfApp(rev).map((e) => `${e.from}>${e.to}`).sort()
  assert(revHits.join(',') === 'src/lib/x.ts>src/app/tabs.ts,src/pages/P.tsx>src/app/AppRoot.tsx', `웹→앱 가져오기(타입 포함) 검출 (결과: ${revHits})`)

  assert(nonPrefixedClasses('.app-a .b{x:1} @media (x){.app-c:hover,.d{y:2}} /* .e */ :root{--k:1}').join(',') === 'b,d', 'app- 없는 클래스 검출')
  assert(strictNameHits(['src/app/LoginScreen.tsx', 'src/app/AuthGate.tsx', 'src/app/urls.ts']).join(',') === 'src/app/AuthGate.tsx,src/app/urls.ts', 'auth·rls 이름 검출(urls 포함)')
}

// ---- 실제 저장소 검사 -----------------------------------------------------------------------
type Fs = {
  readFileSync(p: URL, enc: string): string
  readdirSync(p: URL, o: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>
}
// 다른 시험(screenAudit.test.ts)과 같은 방식 — 앱 타입 검사에 node 형식을 넣지 않는다.
const fsModule = 'node:fs'
const fs = (await import(/* @vite-ignore */ fsModule)) as Fs
const root = new URL('../../', import.meta.url)

function loadSrc(): Files {
  const files: Files = new Map()
  const walk = (rel: string) => {
    for (const e of fs.readdirSync(new URL(rel + '/', root), { withFileTypes: true })) {
      const p = rel + '/' + e.name
      if (e.isDirectory()) walk(p)
      else files.set(p, isSource(p) || p.endsWith('.css') ? fs.readFileSync(new URL(p, root), 'utf8') : '')
    }
  }
  walk('src')
  return files
}
const files = loadSrc()
assert(files.has('src/app/main.tsx') && files.has('src/pages/Home.tsx'), '저장소 파일을 읽지 못함')

// 1) 앱 → 웹 화면 코드
const appRoots = [...files.keys()].filter((p) => isApp(p) && isSource(p) && !isTest(p))
const chains = findForbiddenChains(files, appRoots)
assert(chains.length === 0, '앱이 웹 화면 코드를 가져옴:\n  ' + chains.join('\n  '))

// 2) 허용한 지도 부품 자체가 웹 화면 코드에 기대지 않는지
const mapRoots = [...files.keys()].filter((p) => isMapAllowed(p) && isSource(p) && !isTest(p))
assert(mapRoots.length > 5, '허용 지도 부품을 찾지 못함(경로가 바뀌었나?)')
const mapChains = findForbiddenChains(files, mapRoots)
assert(mapChains.length === 0, '앱이 쓰는 지도 부품이 웹 화면 코드에 기댐(앱 허용 목록 재검토 필요):\n  ' + mapChains.join('\n  '))

// 3) 웹 → 앱
const rev = findWebImportsOfApp(files)
assert(rev.length === 0, '웹이 src/app을 가져옴:\n  ' + rev.map((e) => `${e.from} → ${e.to}`).join('\n  '))

// 4) 입구·스타일·이름·탭·배포 규칙
const appPaths = [...files.keys()].filter(isApp)
const nameHits = strictNameHits(appPaths)
assert(nameHits.length === 0, 'src/app 파일 경로에 auth·rls 금지(approval-gate STRICT 경로에 걸림, 로그인 화면은 login으로): ' + nameHits.join(', '))

const html = fs.readFileSync(new URL('app.html', root), 'utf8')
assert(/<html[^>]*\blang="vi"/.test(html), 'app.html은 lang="vi"여야 함')
assert(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), 'app.html에 noindex 필요')
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1])
assert(scripts.length === 1 && scripts[0] === '/src/app/main.tsx', 'app.html의 스크립트는 /src/app/main.tsx 하나뿐이어야 함: ' + scripts.join(', '))
assert(!/index\.css|src\/main\.tsx|adsbygoogle/.test(html), 'app.html이 웹 입구·공통 스타일·광고를 불러옴')

const css = files.get('src/app/app.css') ?? ''
assert(css.length > 0, 'src/app/app.css 없음')
const badClasses = nonPrefixedClasses(css)
assert(badClasses.length === 0, 'app.css 클래스 이름은 app- 로 시작해야 함: ' + badClasses.join(', '))

const { SEEKER_TABS, EMPLOYER_TABS, tabsForPath } = await import('./tabs')
assert(SEEKER_TABS.length === 5, '구직자 하단 탭은 5개')
assert(EMPLOYER_TABS.length === 4, '기업 하단 탭은 4개')
assert(SEEKER_TABS.map((t) => t.key).join() === 'home,recommend,map,community,me', '구직자 탭 순서: 홈·추천·지도·커뮤니티·마이')
assert(EMPLOYER_TABS.map((t) => t.key).join() === 'biz-home,biz-manage,biz-post,biz-company', '기업 탭 순서: 홈·공고 관리·공고 등록·기업홈')
const tos = [...SEEKER_TABS, ...EMPLOYER_TABS].map((t) => t.to)
assert(new Set(tos).size === tos.length && tos.every((t) => t.startsWith('/')), '탭 주소는 서로 달라야 하고 /로 시작')
assert(tabsForPath('/') === SEEKER_TABS && tabsForPath('/goi-y') === SEEKER_TABS, '구직자 주소는 구직자 탭')
assert(tabsForPath('/biz') === EMPLOYER_TABS && tabsForPath('/biz/dang-tin') === EMPLOYER_TABS && tabsForPath('/bizarre') === SEEKER_TABS, '/biz 아래만 기업 탭')

const vercel = JSON.parse(fs.readFileSync(new URL('vercel.json', root), 'utf8')) as { rewrites: Array<{ source: string; destination: string }> }
const idx = (src: string) => vercel.rewrites.findIndex((r) => r.source === src)
const catchAll = vercel.rewrites.findIndex((r) => r.destination === '/index.html')
assert(idx('/app') >= 0 && vercel.rewrites[idx('/app')].destination === '/app.html', 'vercel.json: /app → /app.html 규칙 필요')
assert(idx('/app/:path*') >= 0 && vercel.rewrites[idx('/app/:path*')].destination === '/app.html', 'vercel.json: /app/* → /app.html 규칙 필요')
assert(catchAll > idx('/app') && catchAll > idx('/app/:path*'), 'vercel.json: /app 규칙이 웹 전체 규칙(/index.html)보다 앞이어야 함')
// 끝 슬래시 주소(/app/)는 '/app/:path*'에 안 걸려 웹 첫 화면이 나왔다(2026-11-26 운영 deploy-verify 실패로 발견) — 별도 규칙 필수
assert(idx('/app/') >= 0 && vercel.rewrites[idx('/app/')].destination === '/app.html', 'vercel.json: /app/(끝 슬래시) → /app.html 규칙 필요')
assert(catchAll > idx('/app/'), 'vercel.json: /app/ 규칙이 웹 전체 규칙(/index.html)보다 앞이어야 함')
const viteConfig = fs.readFileSync(new URL('vite.config.ts', root), 'utf8')
assert(/input:\s*\{[^}]*app:\s*'app\.html'/.test(viteConfig), "vite.config.ts 빌드 입구에 app.html 필요")

console.log('boundary.test.ts: all assertions passed')

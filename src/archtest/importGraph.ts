// import 그래프 읽기 공용 도구 — src/app/boundary.test.ts에 있던 것을 그대로 옮겼다(동작 변경 없음).
// 경계 시험(앱↔웹: boundary.test.ts, 계층 규칙: layers.test.ts)이 같은 도구로 같은 방식으로 가져오기를 읽는다.
// 타입만 가져오는 것(import type / { type A })은 실행 코드가 아니므로 valueImports에서 제외한다.

export type Files = Map<string, string> // 저장소 루트 기준 경로(/ 구분) → 소스. src 아래 파일만.
export type Edge = { from: string; to: string }


// ---- 가져오기 읽기 ----------------------------------------------------------------------------
export const SRC_EXT = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs']
export const isSource = (p: string) => SRC_EXT.some((e) => p.endsWith(e))
export const isTest = (p: string) => /\.test\.[cm]?[jt]sx?$/.test(p)

export function isTypeOnlyClause(clause: string): boolean {
  const c = clause.trim()
  if (!c.startsWith('{')) return false
  const items = c.slice(1, c.lastIndexOf('}')).split(',').map((s) => s.trim()).filter(Boolean)
  return items.length > 0 && items.every((s) => /^type\s/.test(s))
}

// 실행 코드로 가져오는 상대 경로만 돌려준다(패키지 이름·타입 가져오기는 제외).
export function valueImports(source: string): string[] {
  const out: string[] = []
  const stmt = /^[ \t]*(import|export)\s+(type\s+)?((?:(?!\n[ \t]*(?:import|export)\b)[^'";])*?)\s*from\s*['"]([^'"]+)['"]/gm
  for (const m of source.matchAll(stmt)) {
    if (m[2]) continue
    if (isTypeOnlyClause(m[3])) continue
    out.push(m[4])
  }
  for (const m of source.matchAll(/^[ \t]*import\s+['"]([^'"]+)['"]/gm)) out.push(m[1])
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  return out.filter((s) => s.startsWith('./') || s.startsWith('../'))
}

// 타입 가져오기까지 모두(웹이 src/app을 가져오는지 볼 때 쓴다).
export function allImports(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/^[ \t]*(?:import|export)\s+(?:type\s+)?(?:(?:(?!\n[ \t]*(?:import|export)\b)[^'";])*?\s*from\s*)?['"]([^'"]+)['"]/gm)) out.push(m[1])
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  return out.filter((s) => s.startsWith('./') || s.startsWith('../'))
}

export function dirOf(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}
export function normalize(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}
export const RESOLVE_SUFFIX = ['', '.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.css', '/index.ts', '/index.tsx', '/index.js']
export function resolveImport(files: Files, from: string, spec: string): string | null {
  const base = normalize(dirOf(from) + '/' + spec)
  for (const s of RESOLVE_SUFFIX) if (files.has(base + s)) return base + s
  return null
}

// ---- 계층 규칙에 쓰는 순수성 검사 ----------------------------------------------------------------
// 주석(// 와 /* */)을 걷어 낸 뒤 본다. 'window' 같은 흔한 낱말이 변수 이름으로 쓰이는 경우(jobPostingPolicy의 window 변수)를 잡지 않도록
// 브라우저 전역은 '속성 접근·생성자' 모양으로만 본다.
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}
const BROWSER_GLOBAL = /\b(?:window|document|navigator)\s*\.|\b(?:localStorage|sessionStorage)\b|\bnew\s+CustomEvent\b|\baddEventListener\s*\(/
const REACT_IMPORT = /from\s*['"](?:react|react-dom|react-dom\/[^'"]*|react-router[^'"]*)['"]/
export const SUPABASE_CLIENT = 'src/lib/supabase.ts'
export const isUiZone = (p: string) => /^src\/(?:components|pages|context|app)\//.test(p)

/** 한 파일 자체가 서버·Node에서 못 쓰는 것을 만지는 이유들(React·브라우저 전역·css·브라우저 Supabase 클라이언트·화면 코드 가져오기). 없으면 빈 배열. */
export function impurityOf(files: Files, path: string): string[] {
  const src = files.get(path)
  if (src === undefined || !isSource(path)) return []
  // src/archtest는 검사 도구 자체(Node 전용)다 — 검사 정규식 글자(localStorage 등)가 자기 자신을 걸지 않게 제외한다.
  if (path.startsWith('src/archtest/')) return []
  const text = stripComments(src)
  const out: string[] = []
  if (REACT_IMPORT.test(text)) out.push('react')
  if (BROWSER_GLOBAL.test(text)) out.push('브라우저 전역(window·document·localStorage 등)')
  for (const spec of valueImports(src)) {
    const to = resolveImport(files, path, spec)
    if (!to) continue
    if (to.endsWith('.css')) out.push('css')
    if (to === SUPABASE_CLIENT) out.push('브라우저 Supabase 클라이언트(src/lib/supabase.ts)')
    if (isUiZone(to)) out.push('화면 코드(' + to + ')')
  }
  return [...new Set(out)]
}

/** 시작 파일들에서 src 안의 실행 코드 가져오기를 따라가, 순수하지 않은 파일과 그 가져오기 사슬을 돌려준다. */
export function findImpureClosure(files: Files, roots: string[]): Array<{ file: string; reasons: string[]; chain: string[] }> {
  const out: Array<{ file: string; reasons: string[]; chain: string[] }> = []
  const parent = new Map<string, string | null>()
  const queue: string[] = []
  for (const r of roots) { if (!parent.has(r)) { parent.set(r, null); queue.push(r) } }
  while (queue.length) {
    const cur = queue.shift()!
    const reasons = impurityOf(files, cur)
    if (reasons.length) {
      const chain: string[] = []
      for (let p: string | null | undefined = cur; p; p = parent.get(p)) chain.push(p)
      out.push({ file: cur, reasons, chain: chain.reverse() })
    }
    const src = files.get(cur)
    if (src === undefined || !isSource(cur)) continue
    for (const spec of valueImports(src)) {
      const to = resolveImport(files, cur, spec)
      if (to && to.startsWith('src/') && !parent.has(to)) { parent.set(to, cur); queue.push(to) }
    }
  }
  return out
}

/** src 밖(api·scripts·ops)에서 src 코드를 가져오는 시작점들 — 서버·Node에서 실제로 돌아가는 진입 경로. */
export function nodeRunStarts(files: Files, outsideDirs: string[]): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = []
  for (const [p, src] of files) {
    if (!outsideDirs.some((d) => p.startsWith(d)) || !isSource(p) || isTest(p) || /\.test\.[cm]?[jt]sx?$/.test(p)) continue
    for (const spec of valueImports(src)) {
      const to = resolveImport(files, p, spec)
      if (to && to.startsWith('src/')) out.push({ from: p, to })
    }
  }
  return out
}

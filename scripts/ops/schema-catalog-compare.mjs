// 운영 DB 구조 지문(scripts/ops/jobs/schema-catalog-read.sql 실행 결과)과 격리 시험 DB의 같은 조회 결과를 항목별로 대조한다(읽기만, DB 접속 없음).
// 사용: node scripts/ops/schema-catalog-compare.mjs <운영 결과 파일> <격리 결과 파일> [--json]
// 입력은 psql 출력 또는 GitHub Actions 실행 기록 글(줄 앞 시각 접두는 무시) — `{"kind": ...}` JSON 줄만 읽는다.
// 종료 코드: 0 = 허용되지 않은 불일치 없음 · 1 = 허용되지 않은 불일치 있음 · 2 = 입력 오류(JSON 잘림·파싱 실패·필수 항목 누락·중복 항목) — 입력이 틀리면 '일치'로 보지 않는다.
// 환경 특성상 허용되는 차이는 ALLOWED에 근거(reason)와 함께 적는다(없으면 모든 차이가 불일치).
import { readFileSync } from 'node:fs'
export const ALLOWED = [
  // { kind: 'routines', match: /^public\.map_r1_snapshot/, reason: '시험용 대역(운영은 위치 큐 표에 의존)' },
]
// 항목별 필수 칸(없으면 입력 오류). 값이 null인 것은 허용(키 자체가 있어야 함).
const SHAPE = {
  env: { top: ['extensions', 'schemas', 'publications', 'postgrest_schemas', 'roles'], rows: 'roles', row: ['role', 'bypassrls', 'super', 'login'] },
  tables: { top: ['rows'], rows: 'rows', row: ['schema', 'table', 'kind', 'rls', 'force_rls'] },
  columns: { top: ['rows'], rows: 'rows', row: ['t', 'c', 'udt', 'null', 'def_md5', 'ident', 'gen'] },
  constraints: { top: ['rows'], rows: 'rows', row: ['t', 'name', 'type', 'cols', 'check', 'ref'] },
  indexes: { top: ['rows'], rows: 'rows', row: ['t', 'name', 'md5'] },
  views: { top: ['rows'], rows: 'rows', row: ['name', 'md5'] },
  routines: { top: ['rows'], rows: 'rows', row: ['schema', 'name', 'type', 'returns', 'lang', 'security', 'body_md5', 'search_path', 'exec', 'params'] },
  triggers: { top: ['rows'], rows: 'rows', row: ['schema', 't', 'name', 'event', 'timing', 'orient', 'md5'] },
  policies: { top: ['rows'], rows: 'rows', row: ['schema', 't', 'name', 'permissive', 'roles', 'cmd', 'using_md5', 'check_md5'] },
  grants: { top: ['tables', 'columns'], rows: null },
  sequences_types: { top: ['sequences', 'enums'], rows: null },
}
export class CatalogInputError extends Error {}
export function parseCatalog(text, label = '입력') {
  const out = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf('{"kind"'); if (i < 0) continue
    let o
    try { o = JSON.parse(line.slice(i)) } catch { throw new CatalogInputError(`${label}: JSON이 잘렸거나 파싱 실패(${line.slice(i, i + 40)}…)`) }
    if (!SHAPE[o.kind]) throw new CatalogInputError(`${label}: 알 수 없는 kind ${o.kind}`)
    if (out[o.kind]) throw new CatalogInputError(`${label}: kind ${o.kind}가 두 번 나옴`)
    const sh = SHAPE[o.kind]
    for (const k of sh.top) if (!(k in o)) throw new CatalogInputError(`${label}: ${o.kind}에 필수 칸 ${k} 없음`)
    if (sh.rows) for (const r of o[sh.rows] ?? []) for (const k of sh.row) if (!(k in r)) throw new CatalogInputError(`${label}: ${o.kind} 행에 필수 칸 ${k} 없음`)
    out[o.kind] = o
  }
  for (const k of Object.keys(SHAPE)) if (!out[k]) throw new CatalogInputError(`${label}: kind ${k} 없음(출력이 잘렸거나 일부 문장이 실행되지 않음)`)
  return out
}
const s = (x) => JSON.stringify(x ?? null)
// 오버로드 구분: 인자 모드와 타입 순서가 키에 들어간다. 같은 키가 두 번 나오면 입력 오류.
const routineKey = (r) => `${r.schema}.${r.name}(${(r.params ?? []).map((p) => `${p.mode}:${p.udt}`).join(',')})`
const indexers = {
  env: (d) => [['extensions', s(d.extensions)], ['schemas', s(d.schemas)], ['publications', s(d.publications)], ['postgrest_schemas', s(d.postgrest_schemas)], ...(d.roles ?? []).map((r) => [`role:${r.role}`, s(r)])],
  tables: (d) => (d.rows ?? []).map((r) => [`${r.schema}.${r.table}`, s({ k: r.kind, rls: r.rls, f: r.force_rls })]),
  columns: (d) => (d.rows ?? []).map((r) => [`${r.t}.${r.c}`, s({ udt: r.udt, len: r.len ?? null, null: r.null, def: r.def_md5, ident: r.ident, gen: r.gen })]),
  constraints: (d) => (d.rows ?? []).map((r) => [`${r.t}.${r.name}`, s({ type: r.type, cols: r.cols, check: r.check, ref: r.ref })]),
  indexes: (d) => (d.rows ?? []).map((r) => [`${r.t}.${r.name}`, r.md5]),
  views: (d) => (d.rows ?? []).map((r) => [r.name, r.md5]),
  routines: (d) => (d.rows ?? []).map((r) => [routineKey(r), s({ type: r.type, returns: r.returns, lang: r.lang, security: r.security, body: r.body_md5, sp: r.search_path, exec: r.exec, params: r.params })]),
  triggers: (d) => (d.rows ?? []).map((r) => [`${r.schema}.${r.t}.${r.name}.${r.event}`, s({ timing: r.timing, orient: r.orient, md5: r.md5 })]),
  policies: (d) => (d.rows ?? []).map((r) => [`${r.schema}.${r.t}.${r.name}`, s({ p: r.permissive, roles: r.roles, cmd: r.cmd, u: r.using_md5, c: r.check_md5 })]),
  grants: (d) => [...(d.tables ?? []).map((r) => [`table:${r.t}:${r.g}:${r.p}`, '1']), ...(d.columns ?? []).map((r) => [`col:${r.t}.${r.c}:${r.g}:${r.p}`, '1'])],
  sequences_types: (d) => [...(d.sequences ?? []).map((r) => [`seq:${r.name}`, r.type]), ...(d.enums ?? []).map((r) => [`enum:${r.type}`, s(r.labels)])],
}
const toMap = (kind, pairs, label) => {
  const m = new Map()
  for (const [k, v] of pairs) { if (m.has(k)) throw new CatalogInputError(`${label}: ${kind}에 같은 항목이 두 번 나옴(${k})`); m.set(k, v) }
  return m
}
export function compareCatalogs(prod, iso, allowed = ALLOWED) {
  const report = {}
  for (const [kind, ix] of Object.entries(indexers)) {
    const a = toMap(kind, ix(prod[kind]), '운영'), b = toMap(kind, ix(iso[kind]), '격리')
    const r = { match: 0, differ: [], onlyProd: [], onlyIso: [], allowed: [] }
    const allow = (k) => allowed.find((x) => x.kind === kind && x.match.test(k))
    const put = (k, list) => { const al = allow(k); (al ? r.allowed : list).push(al ? `${k} — ${al.reason}` : k) }
    for (const [k, v] of a) { if (!b.has(k)) put(k, r.onlyProd); else if (b.get(k) !== v) put(k, r.differ); else r.match++ }
    for (const k of b.keys()) if (!a.has(k)) put(k, r.onlyIso)
    report[kind] = r
  }
  return report
}
export const mismatchCount = (report) => Object.values(report).reduce((n, r) => n + r.differ.length + r.onlyProd.length + r.onlyIso.length, 0)
// 입력 텍스트 두 개 → { code, report }. 입력 오류는 code 2(예외를 밖으로 내보내지 않고 메시지와 함께 돌려줌).
export function runCompare(prodText, isoText, allowed = ALLOWED) {
  try {
    const report = compareCatalogs(parseCatalog(prodText, '운영 결과'), parseCatalog(isoText, '격리 결과'), allowed)
    return { code: mismatchCount(report) ? 1 : 0, report }
  } catch (e) {
    if (e instanceof CatalogInputError) return { code: 2, error: e.message }
    throw e
  }
}
if (process.argv[1]?.endsWith('schema-catalog-compare.mjs')) {
  const [p, i] = process.argv.slice(2).filter((x) => !x.startsWith('--'))
  if (!p || !i) { console.error('사용: node scripts/ops/schema-catalog-compare.mjs <운영 결과> <격리 결과> [--json]'); process.exit(2) }
  const { code, report, error } = runCompare(readFileSync(p, 'utf8'), readFileSync(i, 'utf8'))
  if (error) { console.error(`입력 오류: ${error}`); process.exit(2) }
  if (process.argv.includes('--json')) console.log(JSON.stringify(report))
  else {
    let match = 0
    for (const [k, r] of Object.entries(report)) { match += r.match; console.log(`${k}: 일치 ${r.match} · 내용 다름 ${r.differ.length} · 운영에만 ${r.onlyProd.length} · 격리에만 ${r.onlyIso.length} · 허용된 차이 ${r.allowed.length}`) }
    console.log(`합계: 일치 ${match} · 불일치 ${mismatchCount(report)}`)
    for (const [k, r] of Object.entries(report)) for (const [t, list] of [['내용 다름', r.differ], ['운영에만', r.onlyProd], ['격리에만', r.onlyIso], ['허용', r.allowed]]) if (list.length) console.log(`\n[${k}] ${t} (${list.length}): ${list.slice(0, 40).join(', ')}${list.length > 40 ? ' …' : ''}`)
  }
  process.exit(code)
}

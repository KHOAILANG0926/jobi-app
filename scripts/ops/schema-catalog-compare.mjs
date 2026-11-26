// 운영 DB 구조 지문(scripts/ops/jobs/schema-catalog-read.sql 실행 결과)과 격리 시험 DB의 같은 조회 결과를 항목별로 대조한다(읽기만, DB 접속 없음).
// 사용: node scripts/ops/schema-catalog-compare.mjs <운영 결과 파일> <격리 결과 파일> [--json]
// 입력 파일은 psql 출력 또는 GitHub Actions 실행 기록 글(줄 앞 시각 접두는 무시) — `{"kind": ...}` JSON 줄만 읽는다.
// 환경 특성상 허용되는 차이는 ALLOWED에 근거와 함께 적는다(없으면 모든 차이가 불일치로 나온다).
import { readFileSync } from 'node:fs'
const ALLOWED = [
  // { kind: 'routines', match: /^public\.map_r1_snapshot/, reason: '시험용 대역(운영은 위치 큐 표에 의존)' },
]
const load = (file) => {
  const out = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('{"kind"'); if (i < 0) continue
    try { const o = JSON.parse(line.slice(i)); out[o.kind] = o } catch { /* 잘린 줄은 건너뜀 */ }
  }
  return out
}
const s = (x) => JSON.stringify(x ?? null)
const sig = (r) => (r.params ?? []).map((p) => p.udt).join(',')
const indexers = {
  env: (d) => new Map([['extensions', s(d.extensions)], ['schemas', s(d.schemas)], ['publications', s(d.publications)], ['postgrest_schemas', s(d.postgrest_schemas)], ...(d.roles ?? []).map((r) => [`role:${r.role}`, s(r)])]),
  tables: (d) => new Map((d.rows ?? []).map((r) => [`${r.schema}.${r.table}`, s({ k: r.kind, rls: r.rls, f: r.force_rls })])),
  columns: (d) => new Map((d.rows ?? []).map((r) => [`${r.t}.${r.c}`, s({ udt: r.udt, len: r.len, null: r.null, def: r.def, ident: r.ident, gen: r.gen })])),
  constraints: (d) => new Map((d.rows ?? []).map((r) => [`${r.t}.${r.name}`, s({ type: r.type, cols: r.cols, check: r.check, ref: r.ref })])),
  indexes: (d) => new Map((d.rows ?? []).map((r) => [`${r.t}.${r.name}`, r.md5])),
  views: (d) => new Map((d.rows ?? []).map((r) => [r.name, r.md5])),
  routines: (d) => new Map((d.rows ?? []).map((r) => [`${r.schema}.${r.name}(${sig(r)})`, s({ type: r.type, returns: r.returns, lang: r.lang, security: r.security, body: r.body_md5, sp: r.search_path, params: r.params })])),
  triggers: (d) => new Map((d.rows ?? []).map((r) => [`${r.schema}.${r.t}.${r.name}.${r.event}`, s({ timing: r.timing, orient: r.orient, md5: r.md5 })])),
  policies: (d) => new Map((d.rows ?? []).map((r) => [`${r.schema}.${r.t}.${r.name}`, s({ p: r.permissive, roles: r.roles, cmd: r.cmd, u: r.using_md5, c: r.check_md5 })])),
  grants: (d) => new Map([...(d.tables ?? []).map((r) => [`table:${r.t}:${r.g}:${r.p}`, '1']), ...(d.columns ?? []).map((r) => [`col:${r.t}.${r.c}:${r.g}:${r.p}`, '1']), ...(d.routines ?? []).map((r) => [`routine:${r.r}:${r.g}`, '1'])]),
  sequences_types: (d) => new Map([...(d.sequences ?? []).map((r) => [`seq:${r.name}`, r.type]), ...(d.enums ?? []).map((r) => [`enum:${r.type}`, s(r.labels)])]),
}
export function compare(prod, iso) {
  const report = {}
  for (const [kind, ix] of Object.entries(indexers)) {
    const a = ix(prod[kind] ?? {}), b = ix(iso[kind] ?? {})
    const r = { match: 0, differ: [], onlyProd: [], onlyIso: [], allowed: [] }
    for (const [k, v] of a) {
      const allow = ALLOWED.find((x) => x.kind === kind && x.match.test(k))
      if (!b.has(k)) (allow ? r.allowed : r.onlyProd).push(allow ? `${k} — ${allow.reason}` : k)
      else if (b.get(k) !== v) (allow ? r.allowed : r.differ).push(allow ? `${k} — ${allow.reason}` : k)
      else r.match++
    }
    for (const k of b.keys()) if (!a.has(k)) { const allow = ALLOWED.find((x) => x.kind === kind && x.match.test(k)); (allow ? r.allowed : r.onlyIso).push(allow ? `${k} — ${allow.reason}` : k) }
    report[kind] = r
  }
  return report
}
if (process.argv[1]?.endsWith('schema-catalog-compare.mjs')) {
  const [p, i] = process.argv.slice(2).filter((x) => !x.startsWith('--'))
  if (!p || !i) { console.error('사용: node scripts/ops/schema-catalog-compare.mjs <운영 결과> <격리 결과> [--json]'); process.exit(2) }
  const prod = load(p), iso = load(i)
  for (const [name, d] of [['운영', prod], ['격리', iso]]) if (!Object.keys(d).length) { console.error(`${name} 결과에서 구조 JSON 줄을 못 찾음`); process.exit(2) }
  const rep = compare(prod, iso)
  if (process.argv.includes('--json')) console.log(JSON.stringify(rep))
  else {
    let match = 0, bad = 0
    for (const [k, r] of Object.entries(rep)) { match += r.match; bad += r.differ.length + r.onlyProd.length + r.onlyIso.length; console.log(`${k}: 일치 ${r.match} · 내용 다름 ${r.differ.length} · 운영에만 ${r.onlyProd.length} · 격리에만 ${r.onlyIso.length} · 허용된 차이 ${r.allowed.length}`) }
    console.log(`합계: 일치 ${match} · 불일치 ${bad}`)
    for (const [k, r] of Object.entries(rep)) for (const [t, list] of [['내용 다름', r.differ], ['운영에만', r.onlyProd], ['격리에만', r.onlyIso], ['허용', r.allowed]]) if (list.length) console.log(`\n[${k}] ${t} (${list.length}): ${list.slice(0, 40).join(', ')}${list.length > 40 ? ' …' : ''}`)
  }
  process.exit(0)
}

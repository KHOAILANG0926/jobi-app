// 운영 DB 구조 지문 대조기(scripts/ops/schema-catalog-compare.mjs) 시험 — 정상 일치와 각 실패 조건을 실제로 돌려 본다(기존 npm test에서 실행).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// @ts-expect-error — 순수 JS 도구(타입 선언 없음)
import { runCompare, parseCatalog, compareFunctionLines, ALLOWED } from '../scripts/ops/schema-catalog-compare.mjs'

const col = (t: string, c: string, o: Record<string, unknown> = {}) => ({ t, c, n: 1, udt: 'text', len: null, null: 'YES', def_md5: null, ident: 'NO', gen: false, ...o })
const routine = (name: string, udts: string[], o: Record<string, unknown> = {}) => ({
  schema: 'public', name, type: 'FUNCTION', returns: 'text', lang: 'plpgsql', security: 'INVOKER', body_md5: 'b1', search_path: 'search_path=public', exec: ['authenticated'],
  params: udts.map((udt, i) => ({ n: `p${i}`, udt, mode: 'IN', has_default: false })), ...o,
})
const base = () => ({
  env: { kind: 'env', extensions: ['plpgsql'], schemas: ['public'], publications: null, postgrest_schemas: ['public, graphql_public'], roles: [{ role: 'anon', bypassrls: false, super: false, login: false }] },
  tables: { kind: 'tables', rows: [{ schema: 'public', table: 'local_jobs', kind: 'r', rls: true, force_rls: false }] },
  columns: { kind: 'columns', rows: [col('local_jobs', 'id', { udt: 'int8' }), col('local_jobs', 'title')] },
  constraints: { kind: 'constraints', rows: [{ t: 'local_jobs', name: 'local_jobs_pkey', type: 'PRIMARY KEY', cols: ['id'], check: null, ref: null }] },
  indexes: { kind: 'indexes', rows: [{ t: 'local_jobs', name: 'local_jobs_pkey', md5: 'i1' }] },
  views: { kind: 'views', rows: null },
  routines: { kind: 'routines', rows: [routine('f', ['text']), routine('f', ['int8'])] },
  triggers: { kind: 'triggers', rows: [{ schema: 'public', t: 'local_jobs', name: 'trg', event: 'INSERT', timing: 'BEFORE', orient: 'ROW', md5: 't1' }] },
  policies: { kind: 'policies', rows: [{ schema: 'public', t: 'local_jobs', name: 'pol', permissive: 'PERMISSIVE', roles: ['anon'], cmd: 'SELECT', using_md5: 'u1', check_md5: 'c1' }] },
  grants: { kind: 'grants', tables: [{ t: 'local_jobs', g: 'anon', p: 'SELECT' }], columns: null },
  sequences_types: { kind: 'sequences_types', sequences: null, enums: null },
})
type Cat = ReturnType<typeof base>
const text = (c: Record<string, unknown>, prefix = '2026-11-26T00:00:00.0000000Z ') => Object.values(c).map((o) => prefix + JSON.stringify(o)).join('\n')
const run = (a: Cat, b: Cat, allowed?: unknown) => runCompare(text(a), text(b), allowed)

// 정상 일치: 실행 기록 줄 접두가 있어도 읽고 종료 코드 0
{ const r = run(base(), base()); assert.equal(r.code, 0, '같은 구조는 일치'); assert.ok(Object.values<{ match: number }>(r.report).reduce((n, x) => n + x.match, 0) > 8) }

// 허용되지 않은 불일치 → 종료 코드 1 (열 타입·운영에만·격리에만·함수 본문 지문)
{ const b = base(); b.columns.rows[1] = col('local_jobs', 'title', { udt: 'varchar' }); assert.equal(run(base(), b).code, 1, '열 타입 다름')
  const c = base(); c.tables.rows.push({ schema: 'public', table: 'x', kind: 'r', rls: false, force_rls: false }); const rc = run(base(), c); assert.equal(rc.code, 1); assert.deepEqual(rc.report.tables.onlyIso, ['public.x'], '격리에만 있는 표')
  const d = base(); d.routines.rows[0] = routine('f', ['text'], { body_md5: 'other' }); assert.equal(run(base(), d).code, 1, '함수 본문 지문 다름') }

// 오버로드 구분: 같은 이름 함수는 인자 타입별로 따로 비교, 한쪽만 실행 권한이 다르면 그 오버로드만 불일치
{ const b = base(); b.routines.rows[1] = routine('f', ['int8'], { exec: ['anon', 'authenticated'] })
  const r = run(base(), b); assert.equal(r.code, 1); assert.deepEqual(r.report.routines.differ, ['public.f(IN:int8)'], '실행 권한이 다른 오버로드만 지목'); assert.equal(r.report.routines.match, 1, '다른 오버로드는 일치')
  const c = base(); c.routines.rows.pop(); const rc = run(base(), c); assert.deepEqual(rc.report.routines.onlyProd, ['public.f(IN:int8)'], '한 오버로드가 없으면 그 오버로드만 운영에만') }

// 허용된 차이는 근거와 함께 허용 목록에서만 통과, 허용 밖 차이가 섞이면 여전히 1
{ const b = base(); b.tables.rows.push({ schema: 'public', table: 'sim_only', kind: 'r', rls: false, force_rls: false })
  const allowed = [{ kind: 'tables', match: /^public\.sim_only$/, reason: '시험용 대역' }]
  const r = run(base(), b, allowed); assert.equal(r.code, 0, '허용 목록에 있으면 통과'); assert.match(r.report.tables.allowed[0], /시험용 대역/, '허용 근거가 기록됨')
  b.columns.rows[1] = col('local_jobs', 'title', { null: 'NO' }); assert.equal(run(base(), b, allowed).code, 1, '허용 밖 차이가 섞이면 실패')
  assert.deepEqual(ALLOWED.filter((x: { reason?: string }) => !x.reason), [], '허용 항목은 모두 근거를 가짐') }

// 입력 오류 → 종료 코드 2 (일치로 보지 않음): JSON 잘림·파싱 실패, 필수 kind 누락, kind 중복, 필수 칸 누락, 항목 중복
{ const cut = text(base()).replace(/\{"kind":"indexes"[^\n]*/, (m) => m.slice(0, m.length - 12))
  const r1 = runCompare(text(base()), cut); assert.equal(r1.code, 2); assert.match(r1.error, /잘렸거나 파싱 실패/, 'JSON 잘림')
  const miss = base() as Record<string, unknown>; delete miss.policies; const r2 = runCompare(text(base()), text(miss)); assert.equal(r2.code, 2); assert.match(r2.error, /kind policies 없음/, '필수 kind 누락')
  const r3 = runCompare(text(base()), text(base()) + '\n' + JSON.stringify(base().tables)); assert.equal(r3.code, 2); assert.match(r3.error, /두 번 나옴/, 'kind 중복')
  const noField = base(); delete (noField.columns.rows[0] as Record<string, unknown>).udt; const r4 = run(base(), noField); assert.equal(r4.code, 2); assert.match(r4.error, /필수 칸 udt 없음/, '필수 칸 누락')
  const dupItem = base(); dupItem.columns.rows.push(col('local_jobs', 'id', { udt: 'int8' })); const r5 = run(base(), dupItem); assert.equal(r5.code, 2); assert.match(r5.error, /같은 항목이 두 번/, '항목 중복')
  const noTop = base() as Record<string, any>; delete noTop.grants.columns; assert.equal(run(base(), noTop as Cat).code, 2, 'grants.columns 칸 없음')
  assert.equal(runCompare('', text(base())).code, 2, '빈 입력')
  assert.throws(() => parseCatalog('{"kind": "zzz"}'), /알 수 없는 kind/) }

// 조회 SQL 보안 모양: 기본값 평문·함수 설정 전체·낱말 필터가 없다
{ const sql = readFileSync(new URL('../scripts/ops/jobs/schema-catalog-read.sql', import.meta.url), 'utf8')
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  assert.ok(!/'def',/.test(code) && /'def_md5'/.test(code), '컬럼 기본값은 md5 지문만')
  assert.ok(!/REDACTED|\(key\|token/.test(code), '낱말 필터 없음')
  assert.ok(/unnest\(a\.proconfig\)/.test(code) && /like 'search_path=%'/.test(code), 'search_path 항목만 추출')
  assert.ok(!/proconfig::text/.test(code), '함수 설정 배열 전체를 출력하지 않음')
  assert.ok(!code.replace(/md5\(coalesce\(r\.routine_definition,''\)\)/g, '').includes('routine_definition') && /body_md5/.test(code), '함수 본문(routine_definition)은 md5 안에서만 쓰임 — 글자 출력 없음') }

// 함수 본문 줄 지문 대조: 같은 줄은 같음, 다른 줄은 번호만, 입력 오류는 예외(종료 코드 2로 이어짐)
{ const fl = (rows: unknown[], major = '17') => '2026-11-26T00:00:00Z ' + JSON.stringify({ kind: 'fn_lines', server_major: major, rows })
  const fn = (name: string, lines: string[]) => ({ schema: 'public', name, params: [{ udt: 'text', mode: 'IN' }], lines })
  const same = compareFunctionLines(fl([fn('f', ['a', 'b', 'c'])]), fl([fn('f', ['a', 'b', 'c'])], '16')); assert.equal(same.functions[0].status, '같음'); assert.equal(same.prodMajor, '17'); assert.equal(same.isoMajor, '16', '서버 주 버전도 함께 돌려줌')
  const diff = compareFunctionLines(fl([fn('f', ['a', 'b', 'c', 'd'])]), fl([fn('f', ['a', 'X', 'c'])])); assert.deepEqual([diff.functions[0].onlyProd, diff.functions[0].onlyIso], [[2, 4], [2]], '다른 줄 번호만(글자 없음)'); assert.equal(diff.functions[0].status, '다름')
  const shifted = compareFunctionLines(fl([fn('f', ['a', 'b', 'c', 'd', 'e'])]), fl([fn('f', ['a', 'NEW', 'b', 'c', 'd', 'e'])])); assert.deepEqual([shifted.functions[0].onlyProd, shifted.functions[0].onlyIso], [[], [2]], '줄이 끼어도 뒤 줄이 밀려 전부 다름으로 나오지 않음(LCS)')
  assert.equal(compareFunctionLines(fl([fn('f', [])]), fl([fn('f', ['a'])])).functions[0].status, '운영 본문 읽기 불가', '운영 줄 0개는 읽기 불가로 구분')
  assert.equal(compareFunctionLines(fl([fn('f', ['a'])]), fl([])).functions[0].status, '격리에 없음')
  assert.throws(() => compareFunctionLines(fl([fn('f', ['a'])]).slice(0, -8), fl([])), /잘렸거나 파싱 실패/, 'JSON 잘림')
  assert.throws(() => compareFunctionLines('', fl([])), /fn_lines 없음/, '빈 입력')
  assert.throws(() => compareFunctionLines(fl([fn('f', ['a']), fn('f', ['b'])]), fl([])), /같은 함수가 두 번/, '함수 중복')
  assert.throws(() => compareFunctionLines(fl([{ schema: 'public', name: 'f' }]), fl([])), /필수 칸 lines 없음/, '필수 칸 누락')
  const sql = readFileSync(new URL('../scripts/ops/jobs/schema-function-lines-read.sql', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  assert.ok(!sql.replace(/md5\(t\.l\)/g, '').includes('t.l') && !/'body'/.test(sql), '줄 글자는 md5 안에서만 쓰임 — 본문 글자 출력 없음')
  assert.ok(/r\.routine_name in \('write_location'/.test(sql), '대상 함수는 고정 목록') }
console.log('schema catalog compare: 정상 일치·불일치(1)·입력 오류(2)·오버로드·허용 목록·조회 SQL 보안 모양 시험 통과')

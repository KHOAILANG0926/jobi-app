// 운영 - 지정 SQL 실행(ops-run-sql.yml)이 실제로 돌릴 SQL을 만든다(Lee 2026-11-09 "좁히기").
// 허용: ① 정식 입구로 기존 공고 고치기 1줄 — select public.ingest_job($ingest${...}$ingest$::jsonb) as job_id \gset
//          (JSON 안에 job_id 숫자 + update_fields 목록 필수. 새 공고 등록은 ops-insert-job으로만.)
//       ② 조회 1줄 문장 — select/with 로 시작, 끝에만 세미콜론, psql 명령(\) 없음, 변수는 :job_id만.
// 글자 검사만 믿지 않는다: 만든 SQL은 입구 호출 바로 뒤(입구 호출이 없으면 처음부터)에 SET TRANSACTION READ ONLY를 건다.
// 그 뒤 문장은 DB가 쓰기를 거부한다(함수 안 쓰기 포함). 한 트랜잭션이라 하나라도 실패하면 입구 호출까지 전부 취소된다.
import { readFileSync } from 'node:fs'

const INGEST = /^select public\.ingest_job\(\$ingest\$(.*)\$ingest\$::jsonb\) as job_id \\gset$/
const QUERY = /^(?:select|with)\s/i
// 읽기 전용 트랜잭션도 막지 못하는 관리 함수(접속 끊기·설정 바꾸기·서버 파일·외부 연결·잠금·대기)는 조회 줄에서 금지.
const ADMIN_FN = /\b(?:pg_\w+|lo_\w+|dblink\w*|set_config|current_setting|query_to_xml\w*|txid_\w*)\s*\(/i

// 화면 표시만 바꾸는 psql 명령(조회 결과를 GitHub 주석으로 찍을 때 씀)과 이미 넣는 읽기 전용 선언은 허용.
const DISPLAY = /^\\pset (?:tuples_only (?:on|off)|format (?:unaligned|aligned))$/
const READ_ONLY = /^set transaction read only;$/i

export function planSql(text) {
  const errors = []
  let ingest = null
  const queries = [], display = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('--'))
  // 문장 = 세미콜론으로 끝나는 줄까지(여러 줄 조회 허용). 입구 호출·psql 표시 명령은 한 줄이 한 문장.
  const stmts = []
  let buf = []
  for (const line of lines) {
    if (!buf.length && (INGEST.test(line) || line.startsWith('\\'))) { stmts.push(line); continue }
    buf.push(line)
    if (line.endsWith(';')) { stmts.push(buf.join('\n')); buf = [] }
  }
  if (buf.length) errors.push(`마지막 문장이 세미콜론으로 끝나지 않음`)
  stmts.forEach((line, i) => {
    const n = `문장 ${i + 1}`
    const m = line.match(INGEST)
    if (m) {
      if (i !== 0) return errors.push(`${n}: 입구 호출은 맨 앞 1번만`)
      if (m[1].includes('$ingest$')) return errors.push(`${n}: 입구 값 안에 $ingest$ 금지`)
      let p
      try { p = JSON.parse(m[1]) } catch { return errors.push(`${n}: 입구 값이 올바른 JSON이 아님`) }
      if (!p || typeof p !== 'object' || Array.isArray(p)) return errors.push(`${n}: 입구 값은 JSON 객체여야 함`)
      if (!Number.isInteger(p.job_id) || p.job_id <= 0) return errors.push(`${n}: job_id(기존 공고 번호) 필수 — 새 공고는 ops-insert-job으로`)
      if (!Array.isArray(p.update_fields) || !p.update_fields.length || !p.update_fields.every((f) => typeof f === 'string'))
        return errors.push(`${n}: update_fields(고칠 칸 목록) 필수`)
      ingest = line
      return
    }
    if (DISPLAY.test(line)) return void display.push(line)
    if (READ_ONLY.test(line)) return
    if (!QUERY.test(line)) return errors.push(`${n}: 입구 호출과 조회(select/with)만 허용`)
    if (line.indexOf(';') !== line.length - 1) return errors.push(`${n}: 한 문장에 조회 1개, 세미콜론은 끝에만`)
    if (line.includes('\\')) return errors.push(`${n}: psql 명령(\\) 금지`)
    if (line.includes('$')) return errors.push(`${n}: $ 인용 금지`)
    // 따옴표 글자 안은 psql이 변수로 바꾸지 않고 함수로 실행되지도 않는다 → 빼고 본다.
    const code = line.replace(/'(?:[^']|'')*'/g, "''")
    // 큰따옴표 이름("pg_cancel_backend")·주석(/**/, --)은 함수 이름 검사를 피해 갈 수 있어 조회 줄에서 금지(Codex #590 지적).
    if (/["]|\/\*|--/.test(code)) return errors.push(`${n}: 큰따옴표 이름·주석 금지`)
    if (ADMIN_FN.test(code)) return errors.push(`${n}: 관리 함수 호출 금지`)
    const vars = code.match(/(?<!:):(?!:)['"]?[A-Za-z_]\w*/g) ?? []
    if (vars.some((v) => v !== ':job_id')) return errors.push(`${n}: psql 변수는 :job_id만`)
    if (vars.length && !ingest) return errors.push(`${n}: :job_id는 입구 호출 뒤에서만`)
    queries.push(line)
  })
  if (!ingest && !queries.length) errors.push('실행할 문장이 없음')
  if (errors.length) return { ok: false, errors }
  const sql = ['\\set ON_ERROR_STOP 1', 'begin;']
  if (ingest) sql.push(ingest)
  sql.push('set transaction read only;', ...display, ...queries, 'commit;')
  return { ok: true, sql: sql.join('\n') + '\n', writes: Boolean(ingest) }
}

// CLI: node scripts/ops/run-sql-plan.mjs <원본.sql> → 실행할 SQL을 표준 출력, 거부면 이유와 종료 코드 1
if (process.argv[1]?.endsWith('run-sql-plan.mjs')) {
  const r = planSql(readFileSync(process.argv[2], 'utf8'))
  if (!r.ok) { for (const e of r.errors) console.error(`::error::${e}`); process.exit(1) }
  process.stdout.write(r.sql)
}

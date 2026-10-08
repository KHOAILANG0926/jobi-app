// 삭제·대량 수정 전 백업 — PC의 backups/ 폴더가 아니라 Supabase 비공개 테이블(research_artifacts, kind=backup)에 저장한다.
// 읽기 전용(DB 쓰기는 비공개 저장소에 백업을 넣는 것뿐). 키 없음: 관리자 로그인 세션 + RLS(관리자 조회 허용 범위)만 쓴다.
//
//   node scripts/research/backup_to_private_store.mjs --label=cleanup_local_jobs \
//        --table=local_jobs[:id.neq.4682] --table=job_work_locations --table=job_location_candidates
//
// --table=<이름>[:<필터>]  필터는 PostgREST 형식 `컬럼.연산자.값`(예: id.neq.4682, job_id.in.(1,2,3)). 여러 번 지정 가능.
// 결과: kind=backup, name=<label>/<UTC타임스탬프>/<table> 로 행 전체(JSON) + 건수·sha256 메타. 관리자 화면 밖에서는 읽을 수 없다.
import crypto from 'node:crypto'
import { adminSession, saveArtifact } from './lib/privateStore.mjs'

const argv = process.argv.slice(2)
const label = (argv.find((a) => a.startsWith('--label=')) ?? '--label=backup').split('=')[1]
const tables = argv.filter((a) => a.startsWith('--table=')).map((a) => a.slice(8))
if (tables.length === 0) { console.error('사용법: --label=<이름> --table=<테이블>[:필터] ...'); process.exit(1) }

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
const { db } = await adminSession()
const PAGE = 500

for (const spec of tables) {
  const [table, filter] = spec.split(':')
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select('*').order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (filter) {
      const [col, op, ...rest] = filter.split('.')
      q = q.filter(col, op, rest.join('.'))
    }
    const { data, error } = await q
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  const sha256 = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  await saveArtifact('backup', `${label}/${stamp}/${table}`, rows, { table, filter: filter ?? null, rows: rows.length, sha256 })
  console.log(`${table}: ${rows.length}행 → 비공개 저장소 backup/${label}/${stamp}/${table} (sha256 ${sha256.slice(0, 12)}…)`)
}

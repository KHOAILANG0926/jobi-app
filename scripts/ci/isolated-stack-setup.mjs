// 격리 실제 스택(Supabase 로컬: GoTrue·PostgREST·Storage·PostgreSQL 17)에 저장소 migration 전체를 올린다 — 운영 DB·운영 열쇠 사용 없음(대표 2026-11-26 지시 5·6번).
// 순서: 운영 이전부터 있던 기반(supabase/tests/baseline/local_jobs_base.sql) → migration 전체(supabase/migrations + 운영엔 적용됐지만 옮겨지지 않은 승인 대기 SQL 2개, 같은 applyMigrations).
// 실제 스택엔 auth·storage·vault·PostGIS·pg_net·pg_cron이 진짜로 있으므로 글자 바꿈(rewrite) 없이 원문 그대로 올린다.
// 못 올라간 파일은 알려진 것만 허용한다: korea 계열 3개(한국 전용 표는 이 기반에 없음)·운영 데이터 상태를 전제하는 다중지점 전환 1개. 새 실패가 생기면 종료 코드 1.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { applyMigrations } from '../../supabase/tests/lib/pg-chain.mjs'

const url = process.env.LOCAL_DB_URL
if (!url || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('LOCAL_DB_URL(로컬 격리 스택 주소) 필요 — 로컬이 아니면 중단'); process.exit(2) }
const KNOWN = new Set(['0012_korea_jobs_expand.sql', '0013_korea_jobs_public_views_grants_fix.sql', '0014_korea_jobs_vi_translation.sql', '20261124120000_multi_branch_conversion.sql'])
const base = spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/tests/baseline/local_jobs_base.sql'], { encoding: 'utf8' })
if (base.status !== 0) { console.error('기반 적용 실패:', base.stderr.split('\n').find((l) => /ERROR/.test(l)) || base.stderr.slice(0, 200)); process.exit(1) }
const { applied, failed } = applyMigrations(url, { rewrite: false })
console.log(`migration ${applied.length}개 적용, 미적용 ${failed.length}개`)
for (const [f, e] of failed) console.log(`  ${KNOWN.has(f) ? '알려진' : '새 실패'}: ${f} — ${e}`)
process.exit(failed.some(([f]) => !KNOWN.has(f)) ? 1 : 0)

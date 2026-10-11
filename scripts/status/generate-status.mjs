// STATUS.md 생성기. GitHub Actions(.github/workflows/status-report.yml)에서만 실행한다.
// DB(Supabase REST, 읽기 전용 GET)와 GitHub API를 직접 조회해 원본 값을 기록한다.
// 쓰기 작업 없음: Supabase에는 GET 요청만 보낸다. VietMap은 호출하지 않는다.
//
// 필요 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY
// 선택: TSC_OUTCOME, BUILD_OUTCOME, TEST_OUTCOME, TEST_LOG(테스트 출력 파일 경로), RUN_URL, OUT(기본 STATUS.md)
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderStatus, parseTestSummary } from './status-lib.mjs'

const env = process.env
const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GITHUB_TOKEN', 'GITHUB_REPOSITORY']
const missing = need.filter((k) => !env[k])
if (missing.length) {
  console.error(`❌ 환경변수 없음: ${missing.join(', ')} — GitHub Secrets 등록 필요. STATUS.md를 만들지 않는다.`)
  process.exit(1)
}

const SB = env.SUPABASE_URL.replace(/\/$/, '')
const sbHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
async function sb(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: sbHeaders })
  if (!r.ok) throw new Error(`Supabase ${path.split('?')[0]} → HTTP ${r.status}`)
  return r.json()
}

const REPO = env.GITHUB_REPOSITORY
const ghHeaders = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
async function gh(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers: ghHeaders })
  if (!r.ok) throw new Error(`GitHub ${path.split('?')[0]} → HTTP ${r.status}`)
  return r.json()
}

const errors = []
async function attempt(label, fn) {
  try { return await fn() } catch (e) { errors.push(`${label}: ${e.message}`); return null }
}

const root = join(import.meta.dirname, '..', '..')
const systemFiles = ['scripts/status/status-lib.mjs', 'scripts/status/generate-status.mjs', '.github/workflows/status-report.yml', '.github/workflows/status-guard.yml']
const hash = createHash('sha256')
for (const f of systemFiles) if (existsSync(join(root, f))) hash.update(readFileSync(join(root, f)))
const selfHash = hash.digest('hex').slice(0, 16)

const head = await attempt('master 커밋', () => gh('/commits/master'))

const mergedPrs = await attempt('병합 PR', async () => {
  const prs = await gh('/pulls?state=closed&base=master&sort=updated&direction=desc&per_page=30')
  return prs.filter((p) => p.merged_at).sort((a, b) => b.merged_at.localeCompare(a.merged_at)).slice(0, 10)
    .map((p) => ({ number: p.number, title: p.title, mergedAt: p.merged_at, sha: p.merge_commit_sha }))
})

const production = await attempt('Production 배포', async () => {
  const deps = await gh('/deployments?environment=Production&per_page=1')
  if (!deps.length) return null
  const d = deps[0]
  const st = await gh(`/deployments/${d.id}/statuses?per_page=1`)
  return { sha: d.sha, createdAt: d.created_at, state: st[0]?.state ?? null }
})

const siteStatus = await attempt('사이트 응답', async () => (await fetch('https://viecganban.vn/', { redirect: 'follow' })).status)

const systemChanges = await attempt('검증 장치 변경 이력', async () => {
  const seen = new Map()
  for (const f of systemFiles) {
    const cs = await gh(`/commits?sha=master&path=${encodeURIComponent(f)}&per_page=3`)
    for (const c of cs) seen.set(c.sha, { sha: c.sha, date: c.commit.committer.date, message: c.commit.message.split('\n')[0] })
  }
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    .map((c) => ({ ...c, recent: new Date(c.date).getTime() > weekAgo }))
})

const jobs = await attempt('공고', async () => {
  const rows = await sb('local_jobs?select=id,source,active,admin_hidden')
  const visible = rows.filter((r) => r.active && !r.admin_hidden)
  const bySource = {}
  for (const r of visible) { const k = (r.source ?? '출처 없음').split(':')[0]; bySource[k] = (bySource[k] ?? 0) + 1 }
  return { total: rows.length, visible: visible.length, bySource, visibleIds: new Set(visible.map((r) => r.id)) }
})

const approvals = await attempt('승인 핀', async () => {
  const cands = await sb('job_location_candidates?select=job_id,reviewed_at,evidence&status=eq.approved&order=reviewed_at.asc')
  if (!cands.length) return []
  const ids = [...new Set(cands.map((c) => c.job_id))].join(',')
  const [locs, js] = await Promise.all([
    sb(`job_work_locations?select=job_id,raw_address&job_id=in.(${ids})`),
    sb(`local_jobs?select=id,company&id=in.(${ids})`),
  ])
  return cands.map((c) => ({
    jobId: c.job_id,
    reviewedAt: c.reviewed_at,
    evidence: c.evidence,
    rawAddress: locs.find((l) => l.job_id === c.job_id)?.raw_address ?? null,
    company: js.find((j) => j.id === c.job_id)?.company ?? null,
    visible: jobs ? jobs.visibleIds.has(c.job_id) : true,
  }))
})

const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
const vietmap = await attempt('VietMap 호출 수', () => sb(`vietmap_usage_daily?select=day,calls,updated_at&day=gte.${since}&order=day.desc`))
const audit = await attempt('관리자 기록', () => sb('admin_audit_logs?select=action,target_type,target_id,created_at&order=created_at.desc&limit=10'))

let tests = null
if (env.TEST_LOG && existsSync(env.TEST_LOG)) tests = parseTestSummary(readFileSync(env.TEST_LOG, 'utf8'))

const { markdown, problems } = renderStatus({
  generatedAt: new Date().toISOString(),
  headSha: head?.sha,
  headTitle: head?.commit?.message?.split('\n')[0],
  runUrl: env.RUN_URL,
  selfHash,
  checks: { tsc: env.TSC_OUTCOME, build: env.BUILD_OUTCOME, testsOutcome: env.TEST_OUTCOME, tests },
  production, siteStatus, mergedPrs, jobs, approvals, vietmap, audit, systemChanges,
})

const errBlock = errors.length
  ? `\n## ❌ 조회 실패 (이 항목들은 위 표에 빠져 있음)\n\n${errors.map((e) => `- ${e}`).join('\n')}\n`
  : ''
const out = env.OUT ?? 'STATUS.md'
writeFileSync(out, markdown + errBlock)
console.log(`STATUS 생성: ${out} · 확인 필요 ${problems.length}건 · 조회 실패 ${errors.length}건`)
// 조회 실패가 있으면 실행을 실패로 끝내 GitHub이 실패 알림을 보내게 한다(파일은 그대로 기록).
if (errors.length) process.exit(2)

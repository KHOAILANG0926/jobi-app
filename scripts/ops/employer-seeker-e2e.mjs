// 고용주·구직자 실제 로그인 시험(운영 화면, 일회용 시험 계정). 계정은 기존 Supabase 관리자 계정 생성 경로(auth.admin.createUser,
// scripts/e2e-p0-foundation.mjs와 같은 방식)로 이 실행 안에서만 만들고 끝에 지운다 — 대표가 가입하거나 비밀번호를 저장할 필요가 없다.
// 비밀값은 GitHub ops-keys 환경(SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·SUPABASE_DB_URL)만 쓴다. 공고를 공개하지 않는다(신규 공개 금지 유지).
import pg from 'pg'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
  console.log('FAILED: 비밀값 없음 (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL)')
  process.exit(1)
}
const base = process.env.E2E_BASE_URL || 'https://www.viecganban.vn'
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const db = new pg.Client({ connectionString: SUPABASE_DB_URL, connectionTimeoutMillis: 15000 })
const SWEEP_ONLY = process.argv.includes('--sweep')
const marker = randomUUID().replace(/-/g, '').slice(0, 10)
const password = `${randomUUID()}aA1!`
const users = [] // { id, email, role }
let browser
const results = []
const pass = (m) => { results.push(['PASS', m]); console.log('PASS:', m) }

async function createUser(role) {
  const email = `vgb-e2e-${marker}-${role}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, name: `E2E ${role} ${marker}`, e2e_marker: marker } })
  if (error) throw error
  users.push({ id: data.user.id, email, role })
  return users[users.length - 1]
}

async function uiLogin(page, u) {
  await page.goto(base + '/dang-nhap', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(u.email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/dang-nhap'), { timeout: 30000 })
  const hasSession = await page.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)))
  if (!hasSession) throw Error(`${u.role}: 로그인 뒤 브라우저에 세션 없음`)
}

// 이전 실행이 강제 종료(취소·시간 초과·실행기 중단)돼 남긴 일회용 계정을 먼저 지운다. 이 실행기가 만든 계정만 지운다:
// 이메일이 vgb-e2e-*@example.invalid 이고 가입 정보에 e2e_marker가 있는 계정(실제 회원 계정은 이 조건에 걸리지 않는다).
async function sweepLeftovers() {
  const r = await db.query("select id, email from auth.users where email like 'vgb-e2e-%@example.invalid' and raw_user_meta_data ? 'e2e_marker'")
  for (const row of r.rows) {
    const { error } = await admin.auth.admin.deleteUser(row.id)
    if (error) { console.error('SWEEP error:', row.email, error.message); process.exitCode = 1 }
    else console.log('SWEEP: 남아 있던 시험 계정 삭제', row.email)
  }
  const left = await db.query("select count(*)::int as n from auth.users where email like 'vgb-e2e-%@example.invalid' and raw_user_meta_data ? 'e2e_marker'")
  if (left.rows[0].n !== 0) { console.error('CRITICAL: 잔존 시험 계정 삭제 확인 실패', left.rows[0].n); process.exitCode = 1 }
  else console.log('PASS: 잔존 시험 계정 0건 확인')
}
let cleaned = false
async function cleanup() {
  if (cleaned) return
  cleaned = true
  if (browser) await browser.close().catch(() => {})
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) { console.error('CLEANUP user error:', u.role, error.message); process.exitCode = 1 }
  }
  if (users.length) {
    const left = await db.query('select (select count(*) from auth.users where id = any($1::uuid[]))::int as au, (select count(*) from public.account_roles where user_id = any($1::uuid[]))::int as ar', [users.map((u) => u.id)]).catch(() => null)
    if (left?.rows[0]?.au !== 0 || left?.rows[0]?.ar !== 0) { console.error('CRITICAL: 시험 계정 삭제 확인 실패', JSON.stringify(left?.rows[0])); process.exitCode = 1 }
    else console.log('PASS: 시험 계정 2개와 역할 행 삭제 확인(auth.users·account_roles 0)')
  }
}
// 실행 취소·종료 신호가 오면 계정부터 지우고 끝낸다(GitHub Actions 취소는 SIGINT→SIGTERM으로 온다).
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { console.error('신호', sig, '— 시험 계정 정리 후 종료'); await cleanup().catch(() => {}); await db.end().catch(() => {}); process.exit(1) })

try {
  await db.connect()
  await sweepLeftovers()
  if (SWEEP_ONLY) { await db.end(); process.exit(process.exitCode ?? 0) }
  const employer = await createUser('employer')
  const seeker = await createUser('seeker')
  pass(`일회용 시험 계정 2개 생성(기존 관리자 계정 생성 경로) — 표식 ${marker}`)
  const roles = await db.query('select user_id, role from public.account_roles where user_id = any($1::uuid[])', [users.map((u) => u.id)])
  const roleOf = Object.fromEntries(roles.rows.map((r) => [r.user_id, r.role]))
  if (roleOf[employer.id] !== 'employer' || roleOf[seeker.id] !== 'seeker') throw Error('account_roles 역할 불일치: ' + JSON.stringify(roleOf))
  pass('DB 역할 확인: 고용주=employer, 구직자=seeker(가입 시 역할 메타데이터 → 기존 트리거)')

  browser = await chromium.launch({ headless: true })
  for (const [u, protectedPath, label] of [[employer, '/bang-dieu-khien', '고용주 대시보드'], [seeker, '/ho-so', '구직자 프로필']]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await uiLogin(page, u)
    pass(`${u.role} 실제 화면 로그인 성공(세션 저장 확인)`)
    await page.goto(base + protectedPath, { waitUntil: 'networkidle', timeout: 45000 })
    const url = new URL(page.url())
    if (url.pathname.startsWith('/dang-nhap')) throw Error(`${label}: 로그인 상태인데 로그인 화면으로 되돌아감(${protectedPath})`)
    const text = (await page.innerText('body')).replace(/\s+/g, ' ')
    if (text.length < 200) throw Error(`${label}: 화면 내용 너무 짧음`)
    if (errors.length) throw Error(`${label}: 스크립트 오류 ${errors[0]}`)
    await page.screenshot({ path: `employer-seeker-e2e-${u.role}.png`, fullPage: true })
    pass(`${label} 접근·표시 확인(${protectedPath}, 글자 ${text.length}자, 스크립트 오류 0)`)
    await ctx.close()
  }
  console.log('E2E PASS: 고용주·구직자 로그인·권한 화면 확인(공고 공개·지원 없음)')
} catch (e) {
  console.error('E2E FAIL:', e instanceof Error ? e.stack : String(e))
  process.exitCode = 1
} finally {
  await cleanup()
  await db.end().catch(() => {})
}

// 격리 실제 스택 E2E(대표 2026-11-26 지시 5·6번): 실제 GoTrue 로그인 + 실제 PostgREST 권한 + 웹·앱 화면까지 이어서 확인한다.
// 운영 DB·운영 열쇠는 쓰지 않는다 — 로컬 스택(127.0.0.1) 주소·로컬 열쇠만 받고, 아니면 시작 전에 중단한다.
// 웹 코드는 운영 Supabase 주소가 고정돼 있어, 브라우저의 그 주소 요청을 로컬 스택으로 바꿔 보낸다(앱 코드 변경 없음). 운영 주소로는 한 건도 나가지 않는다(바꿔 보내거나 막음).
// 출력에는 상태 코드·오류 코드·통과 여부만 낸다(토큰·열쇠·계정 비밀번호는 내지 않는다).
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const API = process.env.LOCAL_API_URL, ANON = process.env.LOCAL_ANON_KEY, SERVICE = process.env.LOCAL_SERVICE_KEY, DB = process.env.LOCAL_DB_URL
const BASE = process.env.BASE_URL, SHOTS = process.env.SCREENSHOT_DIR || 'isolated-stack-proof'
if (![API, DB].every((u) => u && /(127\.0\.0\.1|localhost)/.test(u)) || !ANON || !SERVICE) { console.error('로컬 격리 스택 주소·열쇠(LOCAL_API_URL·LOCAL_DB_URL·LOCAL_ANON_KEY·LOCAL_SERVICE_KEY)가 필요 — 로컬이 아니면 중단'); process.exit(2) }
mkdirSync(SHOTS, { recursive: true })
const PROD_HOST = 'edhuesdnuxlbcfephutq.supabase.co'
const results = []
const rec = (id, label, pass, note = '') => { results.push({ id, label, pass, note }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${label}${note ? ' — ' + note : ''}`) }
const observe = (id, label, note) => { results.push({ id, label, pass: null, note }); console.log(`OBSERVE ${id} ${label} — ${note}`) }

const call = async (method, path, { token, body, headers } = {}) => {
  const r = await fetch(API + path, { method, headers: { apikey: ANON, authorization: `Bearer ${token ?? ANON}`, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let json; try { json = JSON.parse(text) } catch { /* 본문이 JSON이 아닐 수 있음 */ }
  return { status: r.status, json, code: json?.code ?? json?.error_code ?? '', msg: (json?.message ?? json?.msg ?? '').slice(0, 120) }
}
const sql = (q) => { const r = spawnSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`psql 실패: ${(r.stderr.match(/ERROR:.*/) || [''])[0]}`); return r.stdout.trim() }

const RUN = Date.now()
const PW = `Pw-${RUN}-aA1!`
const COMPANY = 'E2E Isolated Co', TITLE = 'E2E Isolated Role'
const users = {}
const makeUser = async (key, role = 'seeker') => {
  const email = `e2e-${key}-${RUN}@example.com`
  const c = await call('POST', '/auth/v1/admin/users', { token: SERVICE, body: { email, password: PW, email_confirm: true, user_metadata: { role } } })
  if (c.status !== 200 || !c.json?.id) throw new Error(`계정 생성 실패(${key}): ${c.status} ${c.code}`)
  const l = await call('POST', '/auth/v1/token?grant_type=password', { body: { email, password: PW } })
  if (l.status !== 200 || !l.json?.access_token) throw new Error(`로그인 실패(${key}): ${l.status} ${l.code}`)
  users[key] = { email, id: c.json.id, token: l.json.access_token }
  return l
}

// ── 1. 실제 인증(GoTrue) ──
try {
  const l = await makeUser('employer', 'employer'); await makeUser('employer2', 'employer'); await makeUser('seeker'); await makeUser('seeker2'); await makeUser('seeker3')
  rec('A1', '실제 GoTrue 로그인(비밀번호) → 사용자 토큰', l.status === 200)
  const me = await call('GET', '/auth/v1/user', { token: users.seeker.token })
  rec('A2', '발급 토큰으로 사용자 조회', me.status === 200 && me.json?.email === users.seeker.email)
  const bad = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: users.seeker.email, password: 'wrong-password' } })
  rec('A3', '틀린 비밀번호는 거부', bad.status === 400, `status ${bad.status}`)
  const forged = await call('GET', '/rest/v1/local_jobs?select=id&limit=1', { token: users.seeker.token.slice(0, -4) + 'AAAA' })
  rec('A4', '서명이 다른 토큰은 거부', forged.status === 401, `status ${forged.status}`)
  const st = sql(`select count(*) from public.account_statuses where user_id in ('${users.seeker.id}','${users.employer.id}') and status='active'`)
  rec('A5', '가입(auth.users 생성) 때 계정 상태 active 자동 기록(트리거)', st === '2', `active ${st}/2`)
} catch (e) { rec('A0', '인증 준비', false, e.message) }

// ── 2. 시험 데이터(격리 DB 전용): 등록 관문은 별도 시험이 검증하므로 여기선 사용자 트리거를 잠시 끄고 고정 공고 1건을 둔다 ──
let jobId
try {
  const r = spawnSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', `employer_id=${users.employer.id}`, '-f', 'supabase/tests/baseline/isolated_stack_fixture.sql'], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`psql 실패: ${(r.stderr.match(/ERROR:.*/) || [''])[0]}`)
  jobId = Number(r.stdout.split('\n').find((l) => /^\d+$/.test(l)))
  rec('B0', '시험 공고 1건 준비(격리 DB)', Number.isInteger(jobId) && jobId > 0, `id ${jobId}`)
} catch (e) { rec('B0', '시험 공고 준비', false, e.message) }

// ── 3. 실제 PostgREST: 노출·권한·흐름 ──
const openapi = await call('GET', '/rest/v1/')
const paths = Object.keys(openapi.json?.paths ?? {})
rec('C1', 'PostgREST 노출 스키마에 ingest_private 도우미 없음(OpenAPI 경로)', openapi.status === 200 && !paths.some((p) => /\/rpc\/(open_raw|job_state|branch_key|find_existing|audit_admin_create)$/.test(p) || /\/rpc\/link$/.test(p) || /\/rpc\/log$/.test(p)), `경로 ${paths.length}개`)
const priv = await call('POST', '/rest/v1/rpc/job_state', { body: { p_id: 1 }, headers: { 'accept-profile': 'ingest_private', 'content-profile': 'ingest_private' } })
rec('C2', 'ingest_private 스키마로 직접 호출하면 거부(스키마 미노출)', priv.status === 406 || priv.status === 404 || priv.status === 403, `status ${priv.status} ${priv.code}`)

const GUEST_TOKEN = 'g'.repeat(24)
const flows = (label) => [
  ['익명: 공개 공고 목록', async () => { const r = await call('GET', `/rest/v1/local_jobs?select=id,title,company&id=eq.${jobId}`); return r.status === 200 && r.json?.length === 1 }],
  ['익명: 원문 주소(source_url) 열은 못 읽음', async () => { const r = await call('GET', `/rest/v1/local_jobs?select=source_url&id=eq.${jobId}`); return r.status === 401 || r.status === 403 || (r.status === 200 && (r.json ?? []).every((x) => x.source_url == null)) }],
  ['익명: 게스트 등록(ingest_job)', async () => { const r = await call('POST', '/rest/v1/rpc/ingest_job', { body: { p: { channel: 'employer', guest_manage_token: GUEST_TOKEN + label, source_text: `${COMPANY} tuyen. LH 0912345678`, company: COMPANY, title: `guest-${label}`, employer_phone: '0912345678', location: 'KCN Yên Phong, Bắc Ninh', active: true } } }); flows.guestId = r.json; return r.status === 200 && Number.isInteger(r.json) }],
  ['익명: 게스트 관리 링크 조회(get_guest_job)', async () => { const r = await call('POST', '/rest/v1/rpc/get_guest_job', { body: { p_job_id: flows.guestId, p_token: GUEST_TOKEN + label } }); return r.status === 200 && r.json?.length === 1 }],
  ['익명: 지원 insert는 거부', async () => { const r = await call('POST', '/rest/v1/applications', { body: { job_id: jobId, seeker_id: users.seeker.id, employer_id: users.employer.id } }); return r.status === 401 || r.status === 403 }],
  // 운영에는 0020 초안(관리자 함수 anon 회수)이 적용돼 있지 않아 anon이 실행 권한을 가진다(#1070 구조 대조) — 실행 권한이 있어도 함수 안 관리자 확인이 막는지 실제 PostgREST로 본다.
  ['익명: 관리자 함수(admin_set_job_hidden) 호출은 거부되고 공고는 그대로', async () => { const r = await call('POST', '/rest/v1/rpc/admin_set_job_hidden', { body: { target_job_id: jobId, hidden: true, reason: 'e2e' } }); const s = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`); return r.status >= 400 && s.json?.length === 1 }],
  ['익명: 관리자 목록(admin_list_users) 호출은 거부', async () => { const r = await call('POST', '/rest/v1/rpc/admin_list_users', { body: {} }); return r.status >= 400 }],
  ['일반 구직자: 관리자 함수(admin_set_job_hidden) 호출은 거부되고 공고는 그대로', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/rpc/admin_set_job_hidden', { token: u.token, body: { target_job_id: jobId, hidden: true, reason: 'e2e' } }); const s = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`); return r.status >= 400 && s.json?.length === 1 }],
  ['익명·일반 구직자: 관리자 함수(admin_set_account_status) 호출은 거부되고 계정 상태 그대로', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const a = await call('POST', '/rest/v1/rpc/admin_set_account_status', { body: { target_user_id: users.employer.id, next_status: 'suspended', reason: 'e2e' } }); const b = await call('POST', '/rest/v1/rpc/admin_set_account_status', { token: u.token, body: { target_user_id: users.employer.id, next_status: 'suspended', reason: 'e2e' } }); return a.status >= 400 && b.status >= 400 && sql(`select status from public.account_statuses where user_id = '${users.employer.id}'`) === 'active' }],
  ['익명·일반 구직자: 관리자 함수(admin_handle_report) 호출은 거부', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const id = '00000000-0000-0000-0000-000000000000'; const a = await call('POST', '/rest/v1/rpc/admin_handle_report', { body: { target_report_id: id, next_status: 'resolved', note: 'e2e' } }); const b = await call('POST', '/rest/v1/rpc/admin_handle_report', { token: u.token, body: { target_report_id: id, next_status: 'resolved', note: 'e2e' } }); return a.status >= 400 && b.status >= 400 && /admin access required|42501/.test(JSON.stringify([a.json, b.json])) }],
  ['구직자: 공고 목록', async () => { const r = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`, { token: users[`seeker${label === 'after' ? '2' : ''}`].token }); return r.status === 200 && r.json?.length === 1 }],
  ['구직자: 사이트 안 지원(applications insert)', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/applications', { token: u.token, body: { job_id: jobId, seeker_id: u.id, employer_id: users.employer.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', seeker_phone: '0900000000' } }); flows.apply = r.status; return r.status === 201 }],
  ['구직자: 남의 이름으로 지원은 거부', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/applications', { token: u.token, body: { job_id: jobId, seeker_id: users.employer.id, employer_id: users.employer.id } }); return r.status === 401 || r.status === 403 }],
  ['구직자: 본인 활성 여부(is_account_active)', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/rpc/is_account_active', { token: u.token, body: { user_id: u.id } }); return r.status === 200 && r.json === true }],
  ['고용주: 내 공고의 지원자 보기', async () => { const r = await call('GET', `/rest/v1/applications?select=id,seeker_id&job_id=eq.${jobId}`, { token: users.employer.token }); return r.status === 200 && r.json?.length >= 1 }],
  ['고용주: 남의 지원 내역은 못 봄(구직자 토큰으로 전체 조회 시 본인 것만)', async () => { const r = await call('GET', '/rest/v1/applications?select=seeker_id', { token: users.seeker.token }); return r.status === 200 && (r.json ?? []).every((x) => x.seeker_id === users.seeker.id) }],
]
const runFlows = async (label) => { const out = {}; for (const [name, fn] of flows(label)) { try { out[name] = await fn() } catch (e) { out[name] = false } } return out }
let before = {}, after = {}
if (jobId) {
  before = await runFlows('before')
  for (const [n, ok] of Object.entries(before)) rec('D', `현재 권한: ${n}`, ok)
  // 비로그인(anon)이 is_account_active를 부를 수 있는지 — 값만 관찰(대표 결정 항목: 막으면 어떤 흐름이 깨지는지)
  const anonActive = await call('POST', '/rest/v1/rpc/is_account_active', { body: { user_id: users.seeker?.id } })
  observe('E1', '비로그인의 is_account_active 호출', `status ${anonActive.status}${anonActive.status === 200 ? ' (임의 사용자 번호의 활성 여부 조회 가능)' : ' ' + anonActive.code}`)
  // 격리 DB에서만: anon·public 실행 권한을 회수한 뒤 같은 흐름을 다시 돌려 영향을 본다(복구함)
  const had = sql(`select has_function_privilege('anon','public.is_account_active(uuid)','execute')`) === 't'
  sql(`revoke execute on function public.is_account_active(uuid) from anon, public`)
  try {
    after = await runFlows('after')
    const broke = Object.keys(before).filter((n) => before[n] && !after[n])
    observe('E2', 'anon 실행 권한을 회수하면 깨지는 흐름', broke.length ? broke.join(' / ') : '없음(모든 흐름 동일)')
    // 실험 결과(관찰): 격리 DB에서 anon 실행 권한을 회수해 본 것이므로 통과·실패가 아니라 '무엇이 깨지는지'를 남긴다 — 대표 결정 항목(0020 초안)의 근거.
    observe('E3', 'anon 회수 뒤에도 유지되는 익명 흐름', ['익명: 공개 공고 목록', '익명: 게스트 등록(ingest_job)', '익명: 게스트 관리 링크 조회(get_guest_job)'].filter((n) => after[n]).join(' / ') || '없음')
  } finally { if (had) sql(`grant execute on function public.is_account_active(uuid) to anon`) }
}

// ── 3-2. 기업 이용 과정(실제 인증·PostgREST·DB): 등록 → 공개 전 검사 대기 → 수정 → 남의 수정 차단 → 마감, 지원 중복 방지, 세션 만료 뒤 재로그인 ──
if (jobId) {
  const E = users.employer, E2 = users.employer2, S = users.seeker
  try {
    const reg = await call('POST', '/rest/v1/rpc/ingest_job', { token: E.token, body: { p: { channel: 'employer', employer_id: E.id, source_text: 'E2E Life Co\nTuyen nhan vien chay ban nha hang\nKCN Yen Phong, Bac Ninh\nLH 0912345678', company: 'E2E Life Co', title: 'Nhan vien chay ban nha hang', description: 'Phuc vu ban an tai nha hang', location: 'KCN Yen Phong, Bac Ninh', employer_phone: '0912345678', active: true, occupation_code: '5', occupation_evidence: 'Tuyen nhan vien chay ban nha hang' } } })
    const lifeId = reg.json
    rec('H1', '기업회원 공고 등록(실제 ingest_job, 기업 토큰)', reg.status === 200 && Number.isInteger(lifeId), `status ${reg.status} ${reg.code}`)
    if (Number.isInteger(lifeId)) {
      const pub = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${lifeId}`)
      rec('H2', '새 기업 공고는 검사 통과 전 비로그인에게 공개되지 않음(공개 전 검사 대기 정책)', pub.status === 200 && pub.json?.length === 0, `익명 조회 ${pub.json?.length}건`)
      const own = await call('GET', `/rest/v1/local_jobs?select=id,active&id=eq.${lifeId}`, { token: E.token })
      rec('H3', '등록한 기업은 자기 공고를 조회', own.status === 200 && own.json?.length === 1)
      // 웹 코드(JobsContext.deleteJob·updateJob)와 같은 호출: 결과 행을 돌려받지 않는 PATCH
      const upd = await call('PATCH', `/rest/v1/local_jobs?id=eq.${lifeId}`, { token: E.token, body: { salary: '9 triệu/tháng' } })
      const mine = await call('GET', `/rest/v1/local_jobs?select=salary&id=eq.${lifeId}`, { token: E.token })
      rec('H4', '기업이 자기 공고 수정(급여)', upd.status < 300 && mine.json?.[0]?.salary === '9 triệu/tháng', `status ${upd.status} ${upd.code}`)
      const other = await call('PATCH', `/rest/v1/local_jobs?id=eq.${lifeId}`, { token: E2.token, body: { salary: '1 triệu' } })
      const after = await call('GET', `/rest/v1/local_jobs?select=salary&id=eq.${lifeId}`, { token: E.token })
      rec('H5', '다른 기업은 남의 공고를 수정할 수 없음(요청이 거부되거나 아무 행도 안 바뀜)', after.json?.[0]?.salary === '9 triệu/tháng', `status ${other.status}`)
    }
    // 공개 중인 시험 공고로: 중복 지원 방지 → 기업 마감 → 마감 뒤 지원·공개 목록
    const dup = await call('POST', '/rest/v1/applications', { token: S.token, body: { job_id: jobId, seeker_id: S.id, employer_id: E.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', seeker_phone: '0900000000' } })
    const first = await call('GET', `/rest/v1/applications?select=id&job_id=eq.${jobId}&seeker_id=eq.${S.id}`, { token: S.token })
    rec('H6', '같은 공고에 중복 지원은 거부(이미 지원한 구직자)', first.json?.length >= 1 && dup.status === 409, `status ${dup.status} ${dup.code}`)
    const close = await call('PATCH', `/rest/v1/local_jobs?id=eq.${jobId}`, { token: E.token, body: { active: false } })
    rec('H7', '기업이 자기 공고를 마감(active=false)', close.status < 300, `status ${close.status} ${close.code}`)
    const gone = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`)
    rec('H8', '마감한 공고는 공개 목록에서 즉시 빠짐', gone.status === 200 && gone.json?.length === 0)
    const S2 = users.seeker3
    const late = await call('POST', '/rest/v1/applications', { token: S2.token, body: { job_id: jobId, seeker_id: S2.id, employer_id: E.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', seeker_phone: '0900000001' } })
    rec('H9', '마감한 공고에는 새 지원이 거부됨', late.status >= 400, `status ${late.status} ${late.code}`)
    // 다음 화면 단계가 쓰므로 다시 연다(기업이 다시 공개로 되돌리는 것은 검사 정책 대상이라, 격리 DB 고정 공고를 직접 되돌린다)
    sql(`alter table public.local_jobs disable trigger user; update public.local_jobs set active = true where id = ${jobId}; alter table public.local_jobs enable trigger user;`)
    // 세션: 로그아웃하면 새로고침 토큰이 더 이상 통하지 않고, 다시 로그인하면 정상
    const sess = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: S.email, password: PW } })
    const rt = sess.json?.refresh_token
    const out = await call('POST', '/auth/v1/logout?scope=global', { token: sess.json?.access_token })
    const refreshed = await call('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: rt } })
    const again = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: S.email, password: PW } })
    rec('H10', '로그아웃 뒤 예전 새로고침 토큰은 거부되고 다시 로그인하면 정상', out.status < 300 && refreshed.status >= 400 && again.status === 200, `logout ${out.status} refresh ${refreshed.status} relogin ${again.status}`)
  } catch (e) { rec('H0', '기업 이용 과정', false, e.message) }
}

// ── 3-3. 구직자 이력서·프로필·메시지·면접 흐름(웹 accountCvStorage·accountProfileStorage·messagesStorage·interviewStorage와 같은 호출) ──
// 세션 만료 시험(H10)이 전체 로그아웃을 했으므로 새로 로그인해 쓴다.
if (jobId) {
  const fresh = async (u) => { const l = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: u.email, password: PW } }); if (l.status !== 200) throw new Error(`재로그인 실패: ${l.status}`); return l.json.access_token }
  try {
    const S = users.seeker, S3 = users.seeker3, E = users.employer, E2 = users.employer2
    const st = await fresh(S), s3t = await fresh(S3), et = await fresh(E), e2t = await fresh(E2)
    // 웹·앱의 저장(lib/ownRowSave.saveOwnRow)과 같은 호출: 본인 줄을 먼저 고치고(PATCH), 줄이 없으면 넣는다(POST). upsert는 user_id 열 UPDATE 권한이 없어 거부된다.
    const own = async (table, token, userId, values) => {
      const u = await call('PATCH', `/rest/v1/${table}?user_id=eq.${userId}`, { token, headers: { prefer: 'return=representation' }, body: values })
      if (u.status < 300 && (u.json ?? []).length > 0) return u
      return call('POST', `/rest/v1/${table}`, { token, headers: { prefer: 'return=minimal' }, body: { user_id: userId, ...values } })
    }
    const rawUpsert = (table, token, body) => call('POST', `/rest/v1/${table}?on_conflict=user_id`, { token, headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body })
    // 프로필·이력서: 저장(upsert) → 다시 읽기 → 남의 것은 못 읽고 못 덮어씀
    const up = await own('user_profiles', st, S.id, { full_name: 'E2E Seeker', phone: '0900000000', email: S.email, city: 'Bắc Ninh', bio: 'e2e', updated_at: new Date().toISOString() })
    const rd = await call('GET', `/rest/v1/user_profiles?select=full_name,city&user_id=eq.${S.id}`, { token: st })
    rec('I1', '구직자 프로필 저장 → 다시 읽기', up.status < 300 && rd.json?.[0]?.full_name === 'E2E Seeker', `저장 ${up.status} ${up.code}`)
    const other = await call('GET', `/rest/v1/user_profiles?select=user_id&user_id=eq.${S.id}`, { token: s3t })
    const forge = await own('user_profiles', s3t, S.id, { full_name: 'HACK', updated_at: new Date().toISOString() })
    const still = await call('GET', `/rest/v1/user_profiles?select=full_name&user_id=eq.${S.id}`, { token: st })
    rec('I2', '다른 구직자는 남의 프로필을 읽지도 덮어쓰지도 못함', (other.json ?? []).length === 0 && forge.status >= 400 && still.json?.[0]?.full_name === 'E2E Seeker', `읽기 ${(other.json ?? []).length}건 / 덮어쓰기 status ${forge.status}`)
    const ups = await rawUpsert('user_cvs', st, { user_id: S.id, cv_data: { summary: 'x' }, photo_path: null, updated_at: new Date().toISOString() })
    observe('I2b', '이력서를 upsert(ON CONFLICT)로 저장하면', `status ${ups.status} ${ups.code} — 웹·앱은 고치고→넣기(saveOwnRow)를 씀`)
    const cvData = { fullName: 'E2E Seeker', summary: 'e2e cv', experiences: [] }
    const cv = await own('user_cvs', st, S.id, { cv_data: cvData, photo_path: null, updated_at: new Date().toISOString() })
    const cvRead = await call('GET', `/rest/v1/user_cvs?select=cv_data&user_id=eq.${S.id}`, { token: st })
    rec('I3', '이력서 저장 → 다시 읽기(수정 후 재저장 포함)', cv.status < 300 && cvRead.json?.[0]?.cv_data?.summary === 'e2e cv', `저장 ${cv.status} ${cv.code}`)
    const cv2 = await own('user_cvs', st, S.id, { cv_data: { ...cvData, summary: 'e2e cv v2' }, photo_path: null, updated_at: new Date().toISOString() })
    const cvRead2 = await call('GET', `/rest/v1/user_cvs?select=cv_data&user_id=eq.${S.id}`, { token: st })
    rec('I4', '이력서 수정 저장이 한 줄로 갱신됨(중복 줄 없음)', cv2.status < 300 && cvRead2.json?.length === 1 && cvRead2.json[0].cv_data.summary === 'e2e cv v2')
    const cvOther = await call('GET', `/rest/v1/user_cvs?select=user_id&user_id=eq.${S.id}`, { token: s3t })
    const cvForge = await own('user_cvs', s3t, S.id, { cv_data: { summary: 'HACK' }, photo_path: null, updated_at: new Date().toISOString() })
    const cvAfter = await call('GET', `/rest/v1/user_cvs?select=cv_data&user_id=eq.${S.id}`, { token: st })
    rec('I5', '다른 구직자는 남의 이력서를 읽지도 덮어쓰지도 못함', (cvOther.json ?? []).length === 0 && cvForge.status >= 400 && cvAfter.json?.[0]?.cv_data?.summary === 'e2e cv v2', `읽기 ${(cvOther.json ?? []).length}건 / 덮어쓰기 status ${cvForge.status}`)

    // 메시지: 구직자가 스레드를 열고 첫 글 → 고용주가 보고 답글 → 구직자가 읽음 처리, 제3자는 못 봄
    const th = await call('POST', '/rest/v1/message_threads', { token: st, headers: { prefer: 'return=representation' }, body: { job_id: jobId, seeker_id: S.id, employer_id: E.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', unread_by_employer: true } })
    const threadId = th.json?.[0]?.id
    const m1 = threadId ? await call('POST', '/rest/v1/messages', { token: st, body: { thread_id: threadId, from_role: 'seeker', body: 'Xin chào, tôi muốn ứng tuyển' } }) : { status: 0 }
    rec('I6', '구직자가 대화를 열고 첫 메시지 전송', th.status === 201 && !!threadId && m1.status === 201, `스레드 ${th.status} ${th.code} / 메시지 ${m1.status}`)
    const eSee = await call('GET', `/rest/v1/message_threads?select=id,unread_by_employer&job_id=eq.${jobId}`, { token: et })
    const eMsgs = threadId ? await call('GET', `/rest/v1/messages?select=body,from_role&thread_id=eq.${threadId}`, { token: et }) : { json: [] }
    rec('I7', '고용주가 자기 공고의 대화와 메시지를 봄(읽지 않음 표시)', eSee.json?.some((t) => t.id === threadId && t.unread_by_employer === true) && eMsgs.json?.length === 1)
    const eRe = threadId ? await call('POST', '/rest/v1/messages', { token: et, body: { thread_id: threadId, from_role: 'employer', body: 'Mời bạn đến phỏng vấn' } }) : { status: 0 }
    const eUp = threadId ? await call('PATCH', `/rest/v1/message_threads?id=eq.${threadId}`, { token: et, body: { unread_by_seeker: true, unread_by_employer: false, updated_at: new Date().toISOString() } }) : { status: 0 }
    const sSee = await call('GET', `/rest/v1/message_threads?select=id,unread_by_seeker&seeker_id=eq.${S.id}`, { token: st })
    const sMsgs = threadId ? await call('GET', `/rest/v1/messages?select=body,from_role&thread_id=eq.${threadId}&order=sent_at.asc`, { token: st }) : { json: [] }
    rec('I8', '고용주 답글 → 구직자가 두 메시지를 순서대로 봄(읽지 않음 표시)', eRe.status === 201 && eUp.status < 300 && sSee.json?.some((t) => t.id === threadId && t.unread_by_seeker === true) && sMsgs.json?.map((m) => m.from_role).join() === 'seeker,employer', `답글 ${eRe.status} 갱신 ${eUp.status}`)
    const readUp = await call('PATCH', `/rest/v1/message_threads?job_id=eq.${jobId}&seeker_id=eq.${S.id}`, { token: st, body: { unread_by_seeker: false } })
    const readNow = await call('GET', `/rest/v1/message_threads?select=unread_by_seeker&id=eq.${threadId}`, { token: st })
    rec('I9', '구직자가 읽음 처리', readUp.status < 300 && readNow.json?.[0]?.unread_by_seeker === false)
    const t3 = await call('GET', `/rest/v1/message_threads?select=id&id=eq.${threadId}`, { token: s3t })
    const t3m = await call('GET', `/rest/v1/messages?select=id&thread_id=eq.${threadId}`, { token: s3t })
    const e2 = await call('GET', `/rest/v1/message_threads?select=id&id=eq.${threadId}`, { token: e2t })
    const e2m = await call('GET', `/rest/v1/messages?select=id&thread_id=eq.${threadId}`, { token: e2t })
    const inject = await call('POST', '/rest/v1/messages', { token: s3t, body: { thread_id: threadId, from_role: 'seeker', body: 'HACK' } })
    const inject2 = await call('POST', '/rest/v1/messages', { token: e2t, body: { thread_id: threadId, from_role: 'employer', body: 'HACK' } })
    rec('I10', '제3자(다른 구직자·다른 기업)는 남의 대화·메시지를 읽지도 끼어들지도 못함', [t3, t3m, e2, e2m].every((r) => (r.json ?? []).length === 0) && inject.status >= 400 && inject2.status >= 400, `끼어들기 구직자 ${inject.status} / 기업 ${inject2.status}`)

    // 면접: 기업이 일정 등록 → 구직자가 확인·수락 → 취소하면 목록에서 빠짐, 제3자는 못 봄·못 바꿈
    const when = new Date(Date.now() + 3 * 86400_000).toISOString()
    const iv = await call('POST', '/rest/v1/interviews', { token: et, headers: { prefer: 'return=representation' }, body: { job_id: jobId, seeker_id: S.id, employer_id: E.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', datetime: when, location: 'KCN Yên Phong', notes: 'e2e', status: 'pending' } })
    const ivId = iv.json?.[0]?.id
    rec('I11', '기업이 지원자에게 면접 일정 등록', iv.status === 201 && !!ivId, `status ${iv.status} ${iv.code}`)
    const ivDup = await call('POST', '/rest/v1/interviews', { token: et, body: { job_id: jobId, seeker_id: S.id, employer_id: E.id, job_title: TITLE, company: COMPANY, datetime: when, location: 'x', notes: '', status: 'pending' } })
    const sIv = await call('GET', `/rest/v1/interviews?select=id,status&seeker_id=eq.${S.id}&status=neq.cancelled`, { token: st })
    rec('I12', '같은 공고·지원자의 면접이 두 줄로 생기지 않고, 구직자가 자기 면접을 봄', ivDup.status === 409 && sIv.json?.length === 1 && sIv.json[0].id === ivId, `중복 등록 status ${ivDup.status}`)
    // 면접 상태는 기업만 바꾼다(웹·앱 모두 구직자 수락 화면 없음 — updateInterviewStatus는 기업 화면 전용)
    const acc = await call('PATCH', `/rest/v1/interviews?id=eq.${ivId}`, { token: et, body: { status: 'confirmed' } })
    const accNow = await call('GET', `/rest/v1/interviews?select=status&id=eq.${ivId}`, { token: st })
    rec('I13', '기업이 면접을 확정으로 바꾸면 구직자 화면에 확정으로 보임', acc.status < 300 && accNow.json?.[0]?.status === 'confirmed', `status ${acc.status} ${acc.code}`)
    const iv3 = await call('GET', `/rest/v1/interviews?select=id&id=eq.${ivId}`, { token: s3t })
    const iv3p = await call('PATCH', `/rest/v1/interviews?id=eq.${ivId}`, { token: s3t, body: { status: 'cancelled' } })
    const ivSp = await call('PATCH', `/rest/v1/interviews?id=eq.${ivId}`, { token: st, body: { status: 'cancelled' } })
    const iv2p = await call('PATCH', `/rest/v1/interviews?id=eq.${ivId}`, { token: e2t, body: { status: 'cancelled' } })
    const ivKeep = await call('GET', `/rest/v1/interviews?select=status&id=eq.${ivId}`, { token: et })
    const ivForge = await call('POST', '/rest/v1/interviews', { token: s3t, body: { job_id: jobId, seeker_id: S3.id, employer_id: E.id, job_title: TITLE, company: COMPANY, datetime: when, location: 'x', notes: '', status: 'confirmed' } })
    rec('I14', '면접 상태는 기업만 바꿈(구직자·제3자 시도는 반영 안 됨), 제3자는 보지 못하고 기업 이름으로 면접을 만들 수 없음', (iv3.json ?? []).length === 0 && ivKeep.json?.[0]?.status === 'confirmed' && ivForge.status >= 400, `취소 시도 제3자 ${iv3p.status} / 지원자 ${ivSp.status} / 다른 기업 ${iv2p.status}, 위조 등록 ${ivForge.status}`)
    const cancel = await call('PATCH', `/rest/v1/interviews?id=eq.${ivId}`, { token: et, body: { status: 'cancelled' } })
    const gone = await call('GET', `/rest/v1/interviews?select=id&seeker_id=eq.${S.id}&status=neq.cancelled`, { token: st })
    rec('I15', '기업이 면접 취소 → 구직자 면접 목록에서 빠짐', cancel.status < 300 && gone.json?.length === 0)
  } catch (e) { rec('I0', '이력서·메시지·면접 흐름', false, e.message) }
}

// ── 3-4. 공고 유형(경로)별 등록·덮어쓰기 규칙(실제 PostgREST·실제 토큰): 수집(crawler_*)·기업(employer)·관리자(admin)·SQL/Lee 확인 경로가 서로의 공고를 덮어쓰지 못하고, 경로 사칭이 막히는지 ──
if (jobId) {
  try {
    const login = async (u) => (await call('POST', '/auth/v1/token?grant_type=password', { body: { email: u.email, password: PW } })).json.access_token
    const et = await login(users.employer), st = await login(users.seeker)
    const reg = (token, p) => call('POST', '/rest/v1/rpc/ingest_job', { token, body: { p } })
    const base = (tag) => ({ source_text: `E2E Type Co ${tag}\nTuyen nhan vien chay ban nha hang\nKCN Yen Phong, Bac Ninh\nLH 0912345678`, company: `E2E Type Co ${tag}`, title: `Nhan vien chay ban ${tag}`, description: 'Phuc vu ban an', location: 'KCN Yen Phong, Bac Ninh', employer_phone: '0912345678', active: true, occupation_code: '5', occupation_evidence: 'Tuyen nhan vien chay ban nha hang' })
    // 경로 사칭: 수집·관리자·SQL·Lee 확인 경로는 일반 사용자·비로그인이 쓸 수 없다
    const imp = []
    for (const [who, token] of [['비로그인', undefined], ['구직자', st], ['기업', et]]) for (const ch of ['crawler_topcv', 'crawler_facebook', 'admin', 'sql_file', 'lee_confirmed']) { const r = await reg(token, { ...base('imp'), channel: ch }); if (!(r.status >= 400 && /42501|insufficient/.test(JSON.stringify(r.json)))) imp.push(`${who}→${ch}:${r.status}`) }
    rec('K1', '수집·관리자·SQL·Lee 확인 경로를 비로그인·구직자·기업이 쓰면 모두 권한 거부(15개 조합)', imp.length === 0, imp.join(' / '))
    const unk = await reg(et, { ...base('unk'), channel: 'made_up' })
    rec('K2', '알 수 없는 경로 이름은 거부', unk.status >= 400)
    // 기업 경로: 같은 내용 두 번 등록 → 같은 공고(중복), source_url은 무시
    const pe = { ...base('emp'), channel: 'employer', employer_id: users.employer.id, source_url: 'https://example.com/e2e-squat' }
    const a = await reg(et, pe), b = await reg(et, pe)
    rec('K3', '기업 경로 같은 내용 재등록은 같은 공고로 돌아옴(중복 판정)', a.status === 200 && b.status === 200 && a.json === b.json, `${a.json} / ${b.json}`)
    const row = await call('GET', `/rest/v1/local_jobs?select=id,origin,source_url&id=eq.${a.json}`, { token: et })
    rec('K4', '기업 경로는 origin=employer로 저장되고 원문 주소(source_url)를 받지 않음', row.json?.[0]?.origin === 'employer' && row.json?.[0]?.source_url == null, JSON.stringify(row.json?.[0] ?? {}).slice(0, 100))
    // 수집 경로(서버 키)가 기업 공고를 다시 수집으로 덮어쓰지 못함
    const over = await reg(SERVICE, { ...base('emp'), channel: 'crawler_topcv', job_id: a.json, refresh: true, title: 'CRAWLER OVERWRITE', salary: '1 triệu', update_fields: ['title', 'salary'] })
    const after = await call('GET', `/rest/v1/local_jobs?select=title,salary&id=eq.${a.json}`, { token: et })
    rec('K5', '수집 경로가 기업 공고를 다시 수집(job_id 지정)해도 제목·급여가 바뀌지 않음', over.status === 200 && after.json?.[0]?.title === base('emp').title && after.json?.[0]?.salary !== '1 triệu', `status ${over.status} 제목 "${after.json?.[0]?.title}"`)
    // 수집 경로 자기 공고: 새로 등록 → 같은 수집 경로의 다시 수집은 갱신됨 → 기업 경로는 수집 공고를 바꾸지 못함
    const cr = await reg(SERVICE, { ...base('crw'), channel: 'crawler_topcv', source_url: `https://example.com/e2e-crw-${RUN}` })
    rec('K6', '수집 경로(서버 키) 새 공고 등록', cr.status === 200 && Number.isInteger(cr.json), `status ${cr.status} ${cr.code}`)
    const crRow = await call('GET', `/rest/v1/local_jobs?select=origin&id=eq.${cr.json}`, { token: SERVICE })
    rec('K7', '수집 경로 공고는 origin=crawler로 저장', crRow.json?.[0]?.origin === 'crawler')
    const refresh = await reg(SERVICE, { ...base('crw'), channel: 'crawler_topcv', job_id: cr.json, refresh: true, salary: '9 triệu/tháng', update_fields: ['salary'] })
    const crAfter = await call('GET', `/rest/v1/local_jobs?select=salary&id=eq.${cr.json}`, { token: SERVICE })
    rec('K8', '수집 경로의 자기 공고 다시 수집은 지정한 칸만 갱신', refresh.status === 200 && crAfter.json?.[0]?.salary === '9 triệu/tháng', `status ${refresh.status}`)
    const empOverCrawler = await reg(et, { ...base('crw'), channel: 'employer', employer_id: users.employer.id, job_id: cr.json, refresh: true, title: 'EMPLOYER OVERWRITE', update_fields: ['title'] })
    const crTitle = await call('GET', `/rest/v1/local_jobs?select=title&id=eq.${cr.json}`, { token: SERVICE })
    rec('K9', '기업 경로로 수집 공고(남의 공고)를 고칠 수 없음', crTitle.json?.[0]?.title !== 'EMPLOYER OVERWRITE', `status ${empOverCrawler.status}`)
    // 다른 기업이 내 공고를 job_id로 다시 등록해 덮어쓰기
    const e2 = await login(users.employer2)
    const hij = await reg(e2, { ...base('emp'), channel: 'employer', employer_id: users.employer2.id, job_id: a.json, refresh: true, title: 'HIJACK', update_fields: ['title'] })
    const hijAfter = await call('GET', `/rest/v1/local_jobs?select=title&id=eq.${a.json}`, { token: et })
    rec('K10', '다른 기업이 남의 공고 번호로 다시 등록해도 내용이 바뀌지 않음', hijAfter.json?.[0]?.title === base('emp').title, `status ${hij.status} ${hij.code}`)
    // 공개 판정: 기업·수집 공고는 직업분류 근거가 있어도 검사 전에는 익명에게 안 보임(공개 규칙은 경로와 무관한 한 곳)
    const pubE = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${a.json}`)
    observe('K11', '익명이 보는 공개 상태', `기업 공고 ${pubE.json?.length ?? 0}건`)
  } catch (e) { rec('K0', '공고 유형별 등록 규칙', false, e.message) }
}

// ── 4. 웹·앱 화면(실제 브라우저, 실제 로컬 스택) ──
if (BASE && jobId) {
  const browser = await chromium.launch()
  const outside = new Set()
  const prepare = async (context) => {
    await context.route('**/*', async (route) => {
    try {
      const u = new URL(route.request().url())
      if (u.host === PROD_HOST) {
        const headers = { ...route.request().headers() }
        const bearer = (headers.authorization ?? '').replace(/^Bearer /, '')
        let ref = ''; try { ref = JSON.parse(Buffer.from(bearer.split('.')[1] ?? '', 'base64url').toString()).ref ?? '' } catch { /* 토큰 모양이 아니면 그대로 */ }
        headers.apikey = ANON
        // 운영 anon 열쇠(웹 코드에 박혀 있음)로 온 요청만 로컬 anon 열쇠로 바꾼다. 사용자 로그인 토큰은 로컬 GoTrue가 발급한 것이라 그대로 둔다.
        if (!bearer || ref === 'edhuesdnuxlbcfephutq') headers.authorization = `Bearer ${ANON}`
        try { return await route.fetch({ url: API + u.pathname + u.search, headers }).then((resp) => route.fulfill({ response: resp })) } catch { return await route.abort() }
      }
      if (u.host === new URL(BASE).host || u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return await route.continue()
      outside.add(u.host); return await route.abort()
    } catch { /* 페이지가 닫히는 중에 이미 처리된 요청 — 무시 */ }
    })
  }
  const reachedProd = () => [...outside].some((h) => /supabase\.co$|viecganban\.vn$/.test(h))
  for (const [name, vp] of [['pc', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport: vp }); await prepare(context)
    const page = await context.newPage()
    const authCalls = []
    page.on('response', (r) => { if (/\/auth\/v1\/token/.test(r.url())) authCalls.push(r.status()) })
    try {
      await page.goto(`${BASE}/dang-nhap`, { waitUntil: 'domcontentloaded' })
      await page.locator('input[type="email"]').fill(users.seeker.email)
      await page.locator('input[type="password"]').fill(PW)
      await page.locator('button[type="submit"]').click()
      await page.waitForFunction(() => Object.keys(localStorage).some((k) => /auth-token/.test(k)), null, { timeout: 30_000 })
      const session = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)); try { return JSON.parse(localStorage.getItem(k)).user?.email } catch { return null } })
      rec('F1', `웹(${name}) 화면 로그인 → 실제 GoTrue 토큰 발급·세션 저장`, session === users.seeker.email && authCalls.includes(200), `토큰 요청 ${authCalls.join(',')}`)
      await page.goto(`${BASE}/viec-lam/sb-${jobId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction((t) => document.body.innerText.includes(t), COMPANY, { timeout: 30_000 })
      rec('F2', `웹(${name}) 공고 상세가 로컬 스택 데이터로 열림`, true)
      await page.screenshot({ path: `${SHOTS}/web-detail-${name}.png` })
      await page.goto(`${BASE}/app/viec-lam/sb-${jobId}`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid="app-detail"][data-job-id]').first().waitFor({ state: 'visible', timeout: 30_000 })
      rec('F3', `앱(${name}) 공고 상세가 같은 데이터로 열림(웹 로그인 세션 공유 환경)`, true)
      const appSession = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)); try { return JSON.parse(localStorage.getItem(k)).user?.email } catch { return null } })
      rec('F4', `앱(${name})에서도 같은 로그인 세션이 보임(웹→앱 교차)`, appSession === users.seeker.email)
      await page.screenshot({ path: `${SHOTS}/app-detail-${name}.png` })
      await page.goto(`${BASE}/app/`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid="app-tabbar"]').first().waitFor({ state: 'visible', timeout: 30_000 })
      const card = page.locator(`[data-job-id="sb-${jobId}"], a[href$="/viec-lam/sb-${jobId}"]`)
      await card.first().waitFor({ state: 'attached', timeout: 30_000 }).then(() => rec('F5', `앱(${name}) 홈에 시험 공고 카드가 보임`, true), async () => rec('F5', `앱(${name}) 홈에 시험 공고 카드가 보임`, false, `홈에 나온 공고 카드 ${await page.locator('[data-job-id]').count()}개 중 없음`))
    } catch (e) { rec('F0', `웹·앱 화면(${name})`, false, e.message.split('\n')[0]) }
    await context.close()
  }
  // ── 앱 등록 → 웹 확인 교차(실제 브라우저·실제 로컬 스택): 기업이 앱(/app/biz/dang-tin)에서 공고를 등록하면 같은 계정의 앱 관리 화면·웹 관리 화면·DB에 같은 공고가 보이고, 비로그인에게는 검사 전이라 안 보인다.
  {
    const APP_TITLE = `Tuyen app ${RUN}`.slice(0, 40)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); await prepare(context)
    const page = await context.newPage()
    try {
      await page.goto(`${BASE}/dang-nhap`, { waitUntil: 'domcontentloaded' })
      await page.locator('input[type="email"]').fill(users.employer.email)
      await page.locator('input[type="password"]').fill(PW)
      await page.locator('button[type="submit"]').click()
      await page.waitForFunction(() => Object.keys(localStorage).some((k) => /auth-token/.test(k)), null, { timeout: 30_000 })
      await page.goto(`${BASE}/app/biz/dang-tin`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid="app-pj"]').waitFor({ state: 'visible', timeout: 30_000 })
      await page.locator('#app-pj-title').fill(APP_TITLE)
      await page.locator('#app-pj-company').fill('E2E App Co')
      await page.getByRole('button', { name: 'Chính thức', exact: true }).click()
      await page.locator('#app-pj-hires').fill('5')
      await page.locator('#app-pj-salary').fill('8000000')
      const pickTime = async (label, re) => { const sel = page.getByLabel(label); const v = await sel.evaluate((el, src) => { const r = new RegExp(src); const o = [...el.options].find((x) => r.test(x.value || x.text)); return o ? o.value || o.text : null }, re.source); await sel.selectOption(v) }
      await pickTime('Giờ bắt đầu', /^08/); await pickTime('Giờ kết thúc', /^17/)
      await page.locator('#app-pj-deadline').fill(new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10))
      await page.getByLabel('Tỉnh / Thành phố').selectOption({ index: 1 })
      await page.getByLabel('Phường / Xã').selectOption({ index: 1 })
      await page.locator('#app-pj-street').fill('12 Nguyễn Văn Cừ')
      await page.locator('#app-pj-phone').fill('0912345678')
      await page.locator('#app-pj-description').fill('Phục vụ bàn tại nhà hàng, làm theo ca')
      await page.getByRole('button', { name: 'Đăng tin', exact: true }).click()
      const ok = await page.locator('[data-testid="app-pj-done"]').waitFor({ state: 'visible', timeout: 45_000 }).then(() => true, () => false)
      const err = ok ? '' : (await page.locator('#app-pj-error').textContent({ timeout: 2000 }).catch(() => '')) || ''
      rec('J1', '앱 공고 등록 화면에서 필수 칸을 채워 등록(실제 ingest_job)', ok, err.slice(0, 120))
      const l = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: users.employer.email, password: PW } })
      const et = l.json?.access_token
      const mine = await call('GET', `/rest/v1/local_jobs?select=id,title,active,employer_id&title=eq.${encodeURIComponent(APP_TITLE)}`, { token: et })
      rec('J2', '웹과 같은 DB 줄로 저장됨(작성 기업 소유, 기업 토큰으로 조회)', mine.json?.length === 1 && mine.json[0].employer_id === users.employer.id, `${mine.json?.length ?? 0}건`)
      const pub = await call('GET', `/rest/v1/local_jobs?select=id&title=eq.${encodeURIComponent(APP_TITLE)}`)
      rec('J3', '앱에서 등록한 새 공고도 검사 전에는 비로그인에게 안 보임(웹과 같은 공개 규칙)', pub.status === 200 && (pub.json ?? []).length === 0)
      await page.goto(`${BASE}/app/biz/quan-ly-tin`, { waitUntil: 'domcontentloaded' })
      const inApp = await page.locator('[data-testid="app-biz-job"]', { hasText: APP_TITLE }).first().waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false)
      rec('J4', '앱 관리 화면(Quản lý tin)에 방금 등록한 공고가 보임', inApp)
      await page.goto(`${BASE}/bang-dieu-khien`, { waitUntil: 'domcontentloaded' })
      const inWeb = await page.waitForFunction((t) => document.body.innerText.includes(t), APP_TITLE, { timeout: 30_000 }).then(() => true, () => false)
      rec('J5', '웹 기업 관리 화면(/bang-dieu-khien)에도 같은 공고가 보임(앱 등록 → 웹 확인)', inWeb)
      await page.screenshot({ path: `${SHOTS}/web-dashboard-after-app-post.png` })
    } catch (e) { rec('J0', '앱 등록→웹 확인 교차', false, e.message.split('\n')[0]) }
    await context.close()
  }
  rec('G1', '브라우저에서 운영 주소(Supabase·서비스)로 나간 요청 없음(전부 로컬로 바꿔 보내거나 막음)', !reachedProd(), `바깥 호스트 ${[...outside].join(',') || '없음'}`)
  await browser.close()
} else observe('F', '웹·앱 화면 단계', 'BASE_URL 없음 또는 시험 공고 없음 — 건너뜀')

const failed = results.filter((r) => r.pass === false)
writeFileSync(`${SHOTS}/result.json`, JSON.stringify(results, null, 1))
const summary = `## 격리 실제 스택 E2E\n통과 ${results.filter((r) => r.pass).length} / 실패 ${failed.length} / 관찰 ${results.filter((r) => r.pass === null).length}\n\n${results.map((r) => `- ${r.pass === null ? '👁' : r.pass ? '✅' : '❌'} ${r.id} ${r.label}${r.note ? ' — ' + r.note : ''}`).join('\n')}\n`
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
process.exit(failed.length ? 1 : 0)

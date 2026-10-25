// Runs only with separate administrator test credentials. Private record; always cleaned up.
import pg from 'pg'
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'

const { ADMIN_E2E_EMAIL, ADMIN_E2E_PASSWORD, SUPABASE_DB_URL } = process.env
if (!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD || !SUPABASE_DB_URL) {
  console.log('SKIPPED: 비밀값 없음 (ADMIN_E2E_EMAIL / ADMIN_E2E_PASSWORD / SUPABASE_DB_URL)')
  process.exit(0)
}
const base = process.env.ADMIN_E2E_BASE_URL || 'https://www.viecganban.vn'
const db = new pg.Client({ connectionString: SUPABASE_DB_URL, connectionTimeoutMillis: 15000 })
let browser, jobId, line
let wroteKind = false
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  await db.connect()
  const next = await db.query("select coalesce(max(id),0)::bigint + 1000000 as id from public.local_jobs")
  jobId = Number(next.rows[0].id)
  const marker = randomUUID().replace(/-/g, '').slice(0, 12)
  line = 'E2E kiểm tra mục tuyển dụng ' + marker
  const check = { detail_fill: { unclassified: [line] } }
  await db.query(`insert into public.local_jobs
    (id,title,company,origin,active,admin_hidden,description,source_text,ocr_check)
    values ($1,$2,'E2E private validation','admin',false,true,'',$3,$4::jsonb)`,
  [jobId, 'E2E PRIVATE ' + marker, line, JSON.stringify(check)])
  browser = await chromium.launch({ headless:true })
  const page = await browser.newPage()
  await page.goto(base + '/dang-nhap?redirect=/admin', { waitUntil:'domcontentloaded' })
  await page.locator('input[type="email"]').fill(ADMIN_E2E_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_E2E_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/admin(?:[?#]|$)/, { timeout:30000 })
  await page.getByRole('button',{name:/Jobs/}).click()
  const text = page.getByText(line, { exact:true })
  await text.waitFor({ state:'visible', timeout:30000 })
  console.log('PASS: 비공개 시험 줄이 관리자 목록에 표시됨 #' + jobId)
  const item = text.locator('xpath=..')
  await item.locator('select').selectOption('02')
  await item.getByRole('button',{ name:'Lưu lựa chọn' }).click()
  await page.getByText(line, { exact:true }).waitFor({ state:'detached', timeout:30000 })
  const kindKey = line.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
  const kind = await db.query('select section, decided_by from public.detail_line_kinds where line_key=$1',[kindKey])
  if(kind.rows[0]?.section!=='02' || kind.rows[0]?.decided_by!=='lee') throw Error('DB decided_by=lee 검사 실패')
  wroteKind = true
  console.log('PASS: 클릭 선택이 DB section=02 / decided_by=lee에 저장됨')
  // Existing job-ocr-check workflow regenerates description from original, not manual edits.
  let desc = ''
  for(let i=0;i<45;i++) {
    const r=await db.query('select description from public.local_jobs where id=$1',[jobId])
    desc=String(r.rows[0]?.description||'')
    if(desc.includes(line) && desc.indexOf('Yêu cầu')!==-1 && desc.indexOf('Yêu cầu')<desc.indexOf(line)) break
    await sleep(4000)
  }
  if(!desc.includes(line) || desc.indexOf('Yêu cầu')<0 || desc.indexOf('Yêu cầu')>desc.indexOf(line))
    throw Error('공고 상세 원문 재생성 미반영 — job-ocr-check dispatch 확인 필요')
  console.log('PASS: DB 상세 내용에 Yêu cầu 영역의 원문 줄 반영됨')
  await page.screenshot({path:'admin-line-pick-e2e.png', fullPage:true})
  console.log('E2E PASS: 테스트 화면 확인 완료')
} catch(e) {
  console.error('E2E FAIL:', e instanceof Error?e.stack:String(e))
  process.exitCode=1
} finally {
  if(browser) await browser.close().catch(()=>{})
  if(jobId!==undefined) {
    await db.query('delete from public.local_jobs where id=$1',[jobId]).catch(e=>console.error('CLEANUP job error:',e.message))
    await db.query('delete from public.detail_line_kinds where example=$1 and decided_by=\'lee\'',[line]).catch(e=>console.error('CLEANUP kind error:',e.message))
    const remaining=await db.query('select count(*)::int as n from public.local_jobs where id=$1',[jobId]).catch(()=>null)
    if(remaining?.rows[0]?.n!==0) {console.error('CRITICAL: test row cleanup not confirmed #' + jobId);process.exitCode=1}
    else console.log('PASS: 비공개 시험 공고 및 분류 행 삭제 검증')
  }
  await db.end().catch(()=>{})
}

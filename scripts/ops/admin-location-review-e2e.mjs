// Private-only admin location review test. NEVER publish test jobs.
// Requires admin test account + service role; workflow skips if missing.
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const {ADMIN_E2E_EMAIL,ADMIN_E2E_PASSWORD,SUPABASE_SERVICE_ROLE_KEY}=process.env
if(!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('SKIPPED: 비밀값 없음 (ADMIN_E2E_EMAIL / ADMIN_E2E_PASSWORD / SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(0)
}
const base=process.env.ADMIN_E2E_BASE_URL || 'https://www.viecganban.vn'
const db=createClient('https://edhuesdnuxlbcfephutq.supabase.co',SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}
})
const ref='Location E2E '+randomUUID().slice(0,8)
const address='E2E EXPLICIT ADDRESS '+randomUUID().slice(0,8)+' Bắc Ninh'
const ids=[Number(Date.now()),Number(Date.now())+1]
const expected={lat:21.1861,lng:106.0763}
let browser
async function checked(promise) {
  const {data,error}=await promise
  if(error)throw Error(error.message)
  return data
}
try {
  await checked(db.from('local_jobs').insert(ids.map((id,i)=>({
    id,title:ref+' '+i,company:'E2E PRIVATE TEST',
    location:address,origin:'admin',active:false,admin_hidden:true,
    description:'Automatic E2E only; never public'
  }))))
  browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(base+'/dang-nhap?redirect=/admin')
  await page.locator('input[type="email"]').fill(ADMIN_E2E_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_E2E_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/admin(?:[?#]|$)/,{timeout:30000})
  await page.getByRole('button',{name:/Vị trí/}).click()
  const card=page.locator('article.admin-location-card').filter({hasText:'#'+ids[0]+' —'}).first()
  await card.waitFor({state:'visible',timeout:30000})
  console.log('PASS: private job in oldest-first location review queue')
  await card.locator('input[type="url"]').fill('https://www.google.com/maps?q=21.186100,106.076300')
  await card.getByRole('button',{name:'Xem tọa độ từ liên kết'}).click()
  await card.getByText('Ghim sẽ xác nhận:').waitFor({state:'visible',timeout:20000})
  await card.getByRole('button',{name:'Xác nhận tọa độ'}).click()
  const testApproved=await checked(db.from('job_location_candidates')
    .select('id,job_id,lat,lng,status,reviewed_by,reviewed_at')
    .in('job_id',ids).eq('status','approved'))
  assert.equal(testApproved.length,2,'second same-address job should receive auto reused point')
  for(const row of testApproved) {
    assert.equal(row.lat,expected.lat)
    assert.equal(row.lng,expected.lng)
    assert.ok(row.reviewed_by && row.reviewed_at,'missing reviewer/time')
  }
  console.log('PASS: approved point and auto-reuse match for two private jobs')
  await page.reload()
  await page.getByRole('button',{name:/Vị trí/}).click()
  await page.getByRole('heading',{name:/Vị trí cần xác nhận/}).waitFor()
  assert.equal(await page.locator('article.admin-location-card').filter({hasText:'#'+ids[0]+' —'}).count(),0)
  assert.equal(await page.locator('article.admin-location-card').filter({hasText:'#'+ids[1]+' —'}).count(),0)
  console.log('PASS: confirmed/auto-applied rows no longer in pending queue')
  await page.screenshot({path:'location-review-e2e.png',fullPage:true})
} catch(error) {
  process.exitCode=1
  console.error('LOCATION E2E FAILED:',error instanceof Error?error.stack:String(error))
} finally {
  if(browser) await browser.close().catch(()=>{})
  const candidates=await db.from('job_location_candidates').select('id,evidence').in('job_id',ids)
  if(candidates.error) {console.error('CLEANUP candidate read failed:',candidates.error.message);process.exitCode=1}
  else {
    const keys=(candidates.data||[]).map(x=>x.id)
    if(keys.length) {
      const erase=await db.from('admin_confirmed_location_memory').delete().in('source_candidate_id',keys)
      if(erase.error) {console.error('CLEANUP memory failed:',erase.error.message);process.exitCode=1}
      // First remove auto-copies; removing their source first would trigger revocation updates
      // against rows participating in the same DELETE statement.
      const autos=(candidates.data||[]).filter(x=>String(x.evidence||'').startsWith('AUTO REUSE:')).map(x=>x.id)
      const originals=(candidates.data||[]).filter(x=>!String(x.evidence||'').startsWith('AUTO REUSE:')).map(x=>x.id)
      for(const batch of [autos,originals]) {
        if(!batch.length)continue
        const e=await db.from('job_location_candidates').delete().in('id',batch)
        if(e.error) {console.error('CLEANUP candidates failed:',e.error.message);process.exitCode=1}
      }
    }
  }
  const del=await db.from('local_jobs').delete().in('id',ids)
  if(del.error) {console.error('CLEANUP private jobs failed:',del.error.message);process.exitCode=1}
  const left=await db.from('local_jobs').select('id').in('id',ids)
  if(left.error || (left.data||[]).length) {console.error('CRITICAL: test jobs remain',ids);process.exitCode=1}
  else console.log('PASS: both private test jobs deleted')
}

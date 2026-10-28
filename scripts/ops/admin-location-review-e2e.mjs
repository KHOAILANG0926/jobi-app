// Private-only admin location review test. NEVER publish test jobs.
// Requires separate admin credentials, service role and DB URL; missing secrets fail.
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import pg from 'pg'
import {sourcePoints,assertPoints} from './location-point-oracle.mjs'

const {ADMIN_E2E_EMAIL,ADMIN_E2E_PASSWORD,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_DB_URL}=process.env
if(!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
  console.log('FAILED: 비밀값 없음 (ADMIN_E2E_EMAIL / ADMIN_E2E_PASSWORD / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL)')
  process.exit(1)
}
const base=process.env.ADMIN_E2E_BASE_URL || 'https://www.viecganban.vn'
const db=createClient('https://edhuesdnuxlbcfephutq.supabase.co',SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}
})
const ref='Location E2E '+randomUUID().slice(0,8)
const address='E2E EXPLICIT ADDRESS '+randomUUID().slice(0,8)+' Bắc Ninh'
const ids=[]
const expected={lat:21.1861,lng:106.0763}
let browser
async function checked(promise) {
  const {data,error}=await promise
  if(error)throw Error(error.message)
  return data
}
try {
  // 등록은 입구(ingest_job) 하나만(Lee 2026-10-29). 입구는 판정 칸을 받지 않으므로 비공개(active=false)로 넣고 바로 숨김.
  for(const i of [0,1]){
    const id=await checked(db.rpc('ingest_job',{p:{channel:'admin',
      title:ref+' '+i,company:'E2E PRIVATE TEST',location:address,active:false,
      description:'Automatic E2E only; never public',
      source_text:'E2E PRIVATE TEST\n'+ref+' '+i+'\n'+address,
      source_url:'https://github.com/KHOAILANG0926/jobi-app/blob/master/scripts/ops/admin-location-review-e2e.mjs#'+ref.replaceAll(' ','-')+'-'+i}}))
    ids.push(id)
    await checked(db.from('local_jobs').update({admin_hidden:true}).eq('id',id).select('id'))
  }
  assert.equal(ids.length,2)
  browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(base+'/dang-nhap?redirect=/admin')
  await page.locator('input[type="email"]').fill(ADMIN_E2E_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_E2E_PASSWORD)
  const login=page.waitForResponse(r=>r.url().includes('/auth/v1/token') && r.request().method()==='POST')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/admin(?:[?#]|$)/,{timeout:30000})
  // Consume the login body before any reload discards its browser network resource.
  const session=await (await login).json()
  assert.ok(session.access_token,'administrator login token missing')
  await page.getByRole('button',{name:/Vị trí/}).click()
  assert.equal(new URL(page.url()).searchParams.get('tab'),'locations')
  await page.getByRole('heading',{name:/Vị trí cần xác nhận/}).waitFor()
  const queueReply=page.waitForResponse(r=>r.url().includes('action=location-review') && r.request().method()==='GET')
  await page.reload()
  const pendingReply=await (await queueReply).json()
  assert.ok(Array.isArray(pendingReply.pending),'queue reply missing pending jobs')
  const queue=page.locator('section').filter({has:page.getByRole('heading',{name:/Vị trí cần xác nhận/})})
  await queue.getByRole('heading',{name:`Vị trí cần xác nhận (${pendingReply.pending.length})`,exact:true}).waitFor({state:'visible'})
  for(const job of pendingReply.pending) {
    await queue.locator('article.admin-location-card').filter({hasText:'#'+job.jobId+' —'}).waitFor({state:'visible',timeout:30000})
  }
  // The public-only queue must never include private synthetic jobs.
  for(const id of ids) assert.equal(await queue.locator('article').filter({hasText:'#'+id+' —'}).count(),0)
  console.log('PASS: real administrator login and public queue; private test jobs excluded')
  // Seed only a pending candidate using the logged-in admin JWT, then approve by real UI click.
  // No route interception, fabricated queue response, or publication of synthetic jobs.
  const admin=createClient('https://edhuesdnuxlbcfephutq.supabase.co',SUPABASE_SERVICE_ROLE_KEY,{
    global:{headers:{Authorization:'Bearer '+session.access_token}},
    auth:{persistSession:false,autoRefreshToken:false}
  })
  const candidate=await checked(admin.rpc('admin_add_location_candidate',{
    p_job_id:ids[0],p_address:address,p_lat:expected.lat,p_lng:expected.lng,
    p_precision:'building',p_source:'other',p_evidence:'Private automated E2E candidate',
    p_evidence_urls:['https://www.google.com/maps?q=21.1861,106.0763'],p_work_location_id:null
  }))
  assert.ok(candidate.id,'pending candidate not created')
  await page.reload()
  await page.getByRole('heading',{name:/Vị trí cần xác nhận/}).waitFor()
  await page.getByRole('button',{name:/Jobs/}).click()
  assert.equal(new URL(page.url()).searchParams.get('tab'),'jobs')
  await page.goBack()
  await page.getByRole('heading',{name:/Vị trí cần xác nhận/}).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('tab'),'locations')
  await page.goForward()
  assert.equal(new URL(page.url()).searchParams.get('tab'),'jobs')
  await page.goBack()
  await page.getByRole('heading',{name:/Vị trí cần xác nhận/}).waitFor()
  // Use this private candidate's evidence link even if Lee has resolved the entire public queue.
  const mapsLink=page.locator('a[href="https://www.google.com/maps?q=21.1861,106.0763"]').first()
  assert.equal(await mapsLink.getAttribute('target'),'_blank')
  const adminUrl=page.url()
  const opened=page.waitForEvent('popup')
  await mapsLink.click()
  const maps=await opened
  await maps.close()
  await page.bringToFront()
  assert.equal(page.url(),adminUrl)
  console.log('PASS: real admin URL tab survives reload, back/forward and Google popup return')
  await page.reload()
  await page.getByRole('button',{name:/Vị trí/}).click()
  const card=page.locator('article.admin-location-card').filter({hasText:'#'+ids[0]+' ·'}).first()
  await card.waitFor({state:'visible',timeout:30000})
  assert.equal(await card.locator('a[href="/viec-lam/sb-'+ids[0]+'"]').getAttribute('target'),'_blank')
  const approve=card.getByRole('button',{name:'Duyệt vị trí',exact:true})
  await approve.scrollIntoViewIfNeeded()
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  const scrollBefore=await page.evaluate(()=>scrollY)
  const approvedResponse=page.waitForResponse(r=>r.url().includes('/rpc/admin_review_location_candidate') && r.request().method()==='POST')
  await approve.click()
  assert.equal((await approvedResponse).ok(),true,'real approval RPC failed')
  await card.waitFor({state:'detached'})
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  const scroll=await page.evaluate(()=>({top:scrollY,max:document.documentElement.scrollHeight-innerHeight}))
  assert.ok(Math.abs(scroll.top-Math.min(scrollBefore,scroll.max))<=2,`approval moved scroll ${scrollBefore} -> ${scroll.top}`)
  assert.equal(new URL(page.url()).searchParams.get('tab'),'locations')
  console.log('PASS: real approval preserved locations tab and scroll position')
  console.log('PASS: private candidate approved by actual administrator click')
  const testApproved=await checked(db.from('job_location_candidates')
    .select('id,job_id,lat,lng,status,reviewed_by,reviewed_at')
    .in('job_id',ids).eq('status','approved'))
  assert.equal(testApproved.length,1,'only the original human decision is an approved candidate')
  assert.equal(String(testApproved[0].id),String(candidate.id),'human decision identity changed')
  for(const row of testApproved) {
    assert.equal(row.lat,expected.lat)
    assert.equal(row.lng,expected.lng)
    assert.ok(row.reviewed_by && row.reviewed_at,'missing reviewer/time')
  }
  // Independent raw SQL source oracle: UI approval/reuse must update every source/cache point.
  const verifyDb=new pg.Client({connectionString:SUPABASE_DB_URL,connectionTimeoutMillis:15000})
  try {
    await verifyDb.connect()
    const {rows:source}=await verifyDb.query('select id,job_id,lat,lng,point_kind,point_precision,point_evidence,point_revision,point_candidate_id,point_memory_id,point_authority from public.job_work_locations where job_id=any($1::bigint[]) order by job_id,sort_order,id',[ids])
    const {rows:cache}=await verifyDb.query('select job_id,source_points from public.map_r1_location_jobs where job_id=any($1::bigint[])',[ids])
    for(const id of ids) {
      const points=sourcePoints(source.filter(w=>String(w.job_id)===String(id)))
      assert.ok(points.length,'approved/reused source missing for generated job '+id)
      assert.ok(points.some(p=>Number(p.lat)===expected.lat && Number(p.lng)===expected.lng && p.kind==='exact' && p.precision==='building'),'approved exact source point missing')
      const reused=source.filter(w=>String(w.job_id)===String(id) && w.point_kind==='exact')
      assert.ok(reused.every(w=>String(w.point_candidate_id)===String(candidate.id) &&
        String(w.point_memory_id)===String(candidate.id) && w.point_authority==='auto_reuse'),'canonical reuse lost original approval evidence')
      for(const row of source.filter(w=>String(w.job_id)===String(id) && w.point_kind!=='unresolved')) assert.ok(row.point_evidence && Object.keys(row.point_evidence).length,'source evidence missing')
      const entry=cache.find(c=>String(c.job_id)===String(id))
      assert.ok(entry,'derived cache missing')
      assertPoints(points,entry.source_points,'complete derived cache for generated job '+id)
    }
  } finally {await verifyDb.end()}
  console.log('PASS: approved point and auto-reuse match for two private jobs')
  await page.reload()
  await page.getByRole('button',{name:/Vị trí/}).click()
  await page.getByRole('heading',{name:/Vị trí cần xác nhận/}).waitFor()
  assert.equal(await page.locator('article.admin-location-card').filter({hasText:'#'+ids[0]+' —'}).count(),0)
  assert.equal(await page.locator('article.admin-location-card').filter({hasText:'#'+ids[1]+' —'}).count(),0)
  console.log('PASS: private confirmed/auto-applied rows remain outside public queue')
  await page.screenshot({path:'location-review-e2e.png',fullPage:true})
} catch(error) {
  process.exitCode=1
  console.error('LOCATION E2E FAILED:',error instanceof Error?error.stack:String(error))
} finally {
  if(browser) await browser.close().catch(()=>{})
  if(ids.length) {
  const candidates=await db.from('job_location_candidates').select('id,evidence').in('job_id',ids)
  if(candidates.error) {console.error('CLEANUP candidate read failed:',candidates.error.message);process.exitCode=1}
  else {
    const keys=(candidates.data||[]).map(x=>x.id)
    if(keys.length) {
      // Verify memory deletion using the existing DB connection before removing its sources.
      const cleanupDb=new pg.Client({connectionString:SUPABASE_DB_URL,connectionTimeoutMillis:15000})
      try {
        await cleanupDb.connect()
        await cleanupDb.query('delete from public.admin_confirmed_location_memory where source_candidate_id=any($1::bigint[])',[keys])
        const left=await cleanupDb.query('select count(*)::int as n from public.admin_confirmed_location_memory where source_candidate_id=any($1::bigint[])',[keys])
        assert.equal(left.rows[0].n,0)
        console.log('PASS: test coordinate memory deleted')
      } catch(e) {console.error('CLEANUP memory failed:',e.message);process.exitCode=1}
      finally {await cleanupDb.end().catch(()=>{})}
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
  const candidateLeft=await db.from('job_location_candidates').select('id').in('job_id',ids)
  if(candidateLeft.error || candidateLeft.data?.length) {console.error('CLEANUP candidates remain or unverified');process.exitCode=1}
  else console.log('PASS: test candidates deleted')
  }
  if(ids.length) {
    const cleanupDb=new pg.Client({connectionString:SUPABASE_DB_URL,connectionTimeoutMillis:15000})
    try {
      await cleanupDb.connect()
      for(const table of ['job_work_locations','map_r1_location_jobs']) {
        const remaining=await cleanupDb.query('select count(*)::int as n from public.'+table+' where job_id=any($1::bigint[])',[ids])
        assert.equal(remaining.rows[0].n,0,'cleanup left generated rows in '+table)
      }
    } catch(e) {console.error('CLEANUP source/cache failed:',e.message);process.exitCode=1}
    finally {await cleanupDb.end().catch(()=>{})}
  }
  if(!process.exitCode) console.log('LOCATION E2E PASS: actual login, visible queue, approval, reuse and cleanup')
}

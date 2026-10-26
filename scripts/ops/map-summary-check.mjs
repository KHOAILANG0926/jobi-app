// Read-only production audit. Public source rows are an independent oracle.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import {hasExcludedMoneyRole} from '../../src/lib/jobPostingPolicy.mjs'
import {sourcePoints,assertPoints,pointsForJob} from './location-point-oracle.mjs'
const base=process.env.BASE_URL||'http://localhost:4173'
const out=process.env.SCREENSHOT_DIR||'map-summary-proof'
const config=await readFile(new URL('../../src/lib/supabase.ts',import.meta.url),'utf8')
const literals=[...config.matchAll(/'([^']+)'/g)].map(m=>m[1])
const db=createClient(process.env.SUPABASE_URL||literals.find(s=>s.startsWith('https://')),process.env.SUPABASE_ANON_KEY||literals.find(s=>s.startsWith('eyJ')),{auth:{persistSession:false,autoRefreshToken:false}})
async function allRows(table,columns,filter) {
 const rows=[]
 for(let from=0;;from+=500) {
  let query=db.from(table).select(columns).order('id').range(from,from+499)
  if(filter)query=filter(query)
  const {data,error}=await query
  if(error)throw Error(`Independent ${table} oracle failed: ${error.message}`)
  rows.push(...data)
  if(data.length<500)return rows
 }
}
const admitted=await allRows('local_jobs','id,title,company,description,category',q=>q.eq('active',true).eq('admin_hidden',false))
const excluded=admitted.filter(hasExcludedMoneyRole).map(j=>j.id)
const jobs=admitted.filter(j=>!hasExcludedMoneyRole(j))
// Query each public job rather than use an IN expression with a URL length ceiling.
const {error:schemaError}=await db.from('job_work_locations')
 .select('id,lat,lng,point_kind,point_precision,point_revision').limit(0)
assert.ifError(schemaError)
const snapshot=[]
for(const job of jobs) snapshot.push({...job,points:sourcePoints(await allRows('job_work_locations','id,lat,lng,point_kind,point_precision,point_revision',q=>q.eq('job_id',job.id)))})
// Audit the public cache projection separately from the rendered map.
for(let from=0;from<snapshot.length;from+=100) {
 const batch=snapshot.slice(from,from+100)
 const response=await fetch(`${base}/api/map-locations?ids=${batch.map(j=>j.id).join(',')}`)
 assert.equal(response.status,200,'public location projection unavailable')
 const payload=await response.json()
 for(const job of batch) {
  const value=payload.points?.[`sb-${job.id}`]
  const actual=Array.isArray(value)?value:value?.points
  assert.ok(Array.isArray(actual),'public cache full point set missing for '+job.id)
  assertPoints(job.points,actual,'public cache/source mismatch job '+job.id)
 }
}
await mkdir(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
const context=await browser.newContext({viewport:{width:1440,height:1000},geolocation:{latitude:Number(snapshot.flatMap(j=>j.points)[0]?.lat??21.0285),longitude:Number(snapshot.flatMap(j=>j.points)[0]?.lng??105.8542)},permissions:['geolocation']})
const page=await context.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const markerSelector='[data-location-points]'
async function rendered(scope) {
 return scope.locator(markerSelector).evaluateAll(elements=>elements.map(el=>JSON.parse(el.getAttribute('data-location-points'))))
}
try {
 await page.goto(base,{waitUntil:'domcontentloaded'})
 await page.locator('.hme__map').scrollIntoViewIfNeeded()
 await page.waitForFunction(()=>{
  const counts=document.querySelector('[data-testid="home-map-job-counts"]')
  return counts && counts.getAttribute('data-loading')!=='true'
 },undefined,{timeout:60000})
 const main=page.locator('.hme-map')
 const verifiedJobs=[]
 const observed=new Map()
 const known=new Set(snapshot.map(j=>String(j.id)))
 for(const job of snapshot) {
  for(const target of job.points) {
   await page.evaluate(point=>localStorage.setItem('vgb:map-r1:viewport',JSON.stringify({center:{lat:Number(point.lat),lng:Number(point.lng)},zoom:16})),target)
   await page.goto(base,{waitUntil:'domcontentloaded'})
   await page.locator('.hme__map').scrollIntoViewIfNeeded()
   await page.waitForFunction(({id,work})=>[...document.querySelectorAll('.hme-map [data-location-points]')].some(el=>JSON.parse(el.getAttribute('data-location-points')).some(p=>String(p.jobId).replace(/^sb-/,'')===String(id)&&String(p.workLocationId)===String(work))),{id:job.id,work:target.workLocationId},{timeout:60000})
   for(const point of (await rendered(main)).flat()) {
    const id=String(point.jobId).replace(/^sb-/,'')
    assert.ok(known.has(id),'main pin represents non-public job')
    const entry=snapshot.find(j=>String(j.id)===id)
    const expected=entry.points.find(p=>String(p.workLocationId)===String(point.workLocationId))
    assert.ok(expected,'extra main source point')
    assertPoints([expected],[point],'rendered main point mismatch')
    observed.set(id+':'+point.workLocationId,{...point,jobId:id})
   }
  }
  await page.goto(`${base}/viec-lam/sb-${job.id}`,{waitUntil:'domcontentloaded'})
  if(job.points.length)await page.locator('.jd2-vmap '+markerSelector).first().waitFor({timeout:60000})
  else {
   await page.locator('.jd2-page h1').waitFor({timeout:30000})
   await page.waitForFunction(()=>!document.querySelector('[role="status"]')?.textContent?.includes('Đang tải'))
  }
  const detailPoints=(await rendered(page.locator('.jd2-vmap'))).flat()
  assertPoints(job.points,detailPoints,`detail source mismatch job ${job.id}`)
  const mainPoints=pointsForJob([[...observed.values()]],job.id)
  assertPoints(job.points,mainPoints,`main complete source mismatch job ${job.id}`)
  const fields=points=>points.map(({workLocationId,lat,lng,kind,precision,revision})=>({workLocationId,lat,lng,kind,precision,revision}))
  const evidence={jobId:job.id,source:fields(job.points),main:fields(mainPoints),detail:fields(detailPoints)}
  verifiedJobs.push(evidence)
  console.log('LOCATION_POINTSET_PASS '+JSON.stringify(evidence))
 }
 for(const job of snapshot) assertPoints(job.points,pointsForJob([[...observed.values()]],job.id),'full observed main point set '+job.id)
 await page.goto(base,{waitUntil:'domcontentloaded'})
 await page.locator('.hme__map').scrollIntoViewIfNeeded()
 const category=page.locator('[data-category]').filter({has:page.locator('strong')})
 await page.getByTestId('map-area-summary').waitFor()
 const choices=await category.evaluateAll(els=>els.filter(el=>Number(el.querySelector('strong')?.textContent)>0).map(el=>el.getAttribute('data-category')))
 if(choices.length) {
  const selected=page.locator('[data-category="'+choices[0]+'"]')
  await selected.click()
  assert.equal(await selected.getAttribute('aria-pressed'),'true')
  const results=page.getByTestId('map-summary-results')
  await results.waitFor()
  assert.ok(await results.locator('.jc').count()>0,'selected actual category has results')
  await results.getByRole('button',{name:'Bỏ lọc ngành',exact:true}).click()
  await results.waitFor({state:'detached'})
 }
 await page.getByRole('button',{name:'Gần tôi',exact:true}).first().click()
 const radius=page.getByRole('spinbutton',{name:'Nhập bán kính (m)',exact:true})
 await radius.fill('400')
 await radius.press('Enter')
 assert.equal(await radius.inputValue(),'400','typed meters preserved')
 await page.locator('.hme').getByRole('button',{name:'20 km',exact:true}).click()
 assert.equal(await radius.inputValue(),'20000','kilometer preset converts to meters')
 const target=snapshot.flatMap(j=>j.points)[0]
 if(target) {
  // Fresh document resets transient radius/category selection, keeping the real source camera.
  await page.evaluate(point=>localStorage.setItem('vgb:map-r1:viewport',JSON.stringify({center:{lat:Number(point.lat),lng:Number(point.lng)},zoom:16})),target)
  await page.goto(base,{waitUntil:'domcontentloaded'})
  await page.locator('.hme__map').scrollIntoViewIfNeeded()
  const actual=page.locator('.hme-map '+markerSelector).first()
  await actual.waitFor({timeout:60000})
  await actual.click({force:true})
  const detail=page.locator('.hme-job__actions a').filter({hasText:'Xem chi tiết'})
  if(!await detail.count()) {
   const choice=page.locator('.hme-map__job-picker button').first()
   await choice.waitFor({timeout:10000})
   await choice.click()
  }
  await detail.waitFor({timeout:10000})
  assert.match(await detail.getAttribute('href'),/^\/viec-lam\//)
  const directions=page.locator('.hme-job__actions a').filter({hasText:/Chỉ đường|Đến cổng KCN|Xem khu vực/})
  await directions.waitFor()
  assert.match(await directions.getAttribute('href'),/^https:\/\/(www\.)?google\.com\/maps/,'selected point directions')
 } else assert.equal(await page.locator('.hme-map '+markerSelector).count(),0,'empty source has no clickable workplace markers')
 await page.locator('.hme').screenshot({path:out+'/summary.png'})
 await page.setViewportSize({width:390,height:844})
 await page.waitForFunction(()=>!document.querySelector('[data-testid="map-area-summary"]'))
 assert.deepEqual(errors,[])
 await writeFile(out+'/result.json',JSON.stringify({base,ok:true,publicJobs:snapshot.length,excludedByPublicAdmission:excluded,verifiedJobs,sourcePoints:snapshot.reduce((n,j)=>n+j.points.length,0),checks:['paginated independent public source','all main/group point sets','all detail point sets','kind precision revision','dynamic category selection','mobile summary absent']},null,2))
 console.log('PASS: independent public source, main and detail point sets agree')
}finally{await browser.close()}

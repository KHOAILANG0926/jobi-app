// Read-only production audit. Public source rows are an independent oracle.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import {hasExcludedMoneyRole} from '../../src/lib/jobPostingPolicy.mjs'
import { skipImages } from './skip-images.mjs'
import {sourcePoints,assertPoints,pointsForJob,settleChange} from './location-point-oracle.mjs'
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
const changed=new Set()
const readFresh=async id=>{
 const [job]=await allRows('local_jobs','id,active,admin_hidden',q=>q.eq('id',id))
 const points=sourcePoints(await allRows('job_work_locations','id,lat,lng,point_kind,point_precision,point_revision',q=>q.eq('job_id',id)))
 return {public:Boolean(job?.active&&!job.admin_hidden),points}
}
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
  try {
   assert.ok(Array.isArray(actual),'public cache full point set missing for '+job.id)
   assertPoints(job.points,actual,'public cache/source mismatch job '+job.id)
  } catch(e) { if(await settleChange(e,job,readFresh)==='changed'){changed.add(job.id);console.log('AUDIT_JOB_CHANGED '+job.id)} }
 }
}
await mkdir(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
const context=await browser.newContext({viewport:{width:1440,height:1000},geolocation:{latitude:Number(snapshot.flatMap(j=>j.points)[0]?.lat??21.0285),longitude:Number(snapshot.flatMap(j=>j.points)[0]?.lng??105.8542)},permissions:['geolocation']})
await skipImages(context,new URL(base).origin)
const page=await context.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
// MAP-1 증거(#946): 지도 스타일 파일 요청의 실제 응답(상태·걸린 시간·주소)을 남긴다. 판정 기준은 바꾸지 않는다. 열쇠(apikey)는 가린다.
const styleRequests=[]
const isStyle=u=>/maps\.vietmap\.vn\/.*style\.json|\/vietmap\/styles\/[a-z]+\.json/.test(u)  // 원본 + 우리 쪽 사본(11-21)
const masked=u=>u.replace(/apikey=[^&]+/,'apikey=***')
page.on('requestfinished',async r=>{ if(!isStyle(r.url()))return; const res=await r.response().catch(()=>null); const t=r.timing(); styleRequests.push({at:new Date().toISOString(),page:page.url(),url:masked(r.url()),status:res?.status()??null,ms:t.responseEnd>=0?Math.round(t.responseEnd):null}) })
page.on('requestfailed',r=>{ if(isStyle(r.url()))styleRequests.push({at:new Date().toISOString(),page:page.url(),url:masked(r.url()),status:null,failure:r.failure()?.errorText??'failed'}) })
async function saveFailure(job,error) {
 const state=await page.evaluate(()=>{ const v=document.querySelector('.jd2-vmap'); return {mapText:v?.textContent?.trim().slice(0,120)??null,mapError:!!document.querySelector('.job-location-map__error'),planned:v?.getAttribute('data-planned-location-points')??null,unavailable:v?.getAttribute('data-map-unavailable')??null,markers:document.querySelectorAll('.jd2-vmap [data-location-points]').length} }).catch(()=>null)
 await page.screenshot({path:`${out}/failure-sb-${job.id}.png`,fullPage:false}).catch(()=>{})
 await writeFile(`${out}/failure-sb-${job.id}.json`,JSON.stringify({jobId:job.id,url:page.url(),error:String(error?.message??error).slice(0,300),state,styleRequests:styleRequests.slice(-6)},null,2)).catch(()=>{})
 console.log('MAP_FAILURE_EVIDENCE '+JSON.stringify({jobId:job.id,state,lastStyle:styleRequests.slice(-3)}))
}
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
  if(changed.has(job.id))continue
  try {
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
  } catch(e) { await saveFailure(job,e); if(await settleChange(e,job,readFresh)==='changed'){changed.add(job.id);console.log('AUDIT_JOB_CHANGED '+job.id)} }
 }
 for(const job of snapshot) if(!changed.has(job.id)) assertPoints(job.points,pointsForJob([[...observed.values()]],job.id),'full observed main point set '+job.id)
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
  // 클릭할 마커 = 시험 대상 지점(target)이 든 마커다. 예전에는 DOM 첫 마커(.first())를 force 클릭했는데, 그 자리가 옆 패널의 카테고리 버튼에 덮여 있으면
  // 마커가 아니라 그 버튼이 눌렸다(#934, 운영 화면 읽기 전용 관찰: 상세·선택 목록이 안 나와 timeout, 또는 엉뚱한 목록의 상세 링크로 통과). 대기 시간·검사 조건은 그대로.
  const markers=page.locator('.hme-map '+markerSelector)
  await markers.first().waitFor({timeout:60000})
  const own=await markers.evaluateAll((els,id)=>els.findIndex(el=>JSON.parse(el.getAttribute('data-location-points')).some(p=>String(p.workLocationId)===String(id))),target.workLocationId)
  assert.ok(own>=0,'target point has its own rendered marker')
  const actual=markers.nth(own)
  await actual.waitFor({timeout:60000})
  const groupSize=await actual.evaluate(el=>JSON.parse(el.getAttribute('data-location-points')).length)  // 클릭하면 마커가 다시 그려지므로 미리 읽는다
  await actual.click()  // force 없음: 다른 요소에 덮여 있으면 눌린 척 통과하지 않고 실패한다
  const detail=page.locator('.hme-job__actions a').filter({hasText:'Xem chi tiết'})
  const choice=page.locator('.hme-map__job-picker button').first()
  await detail.or(choice).first().waitFor({timeout:10000})  // 단일 공고 마커는 상세, 여러 공고 마커는 선택 목록 — 먼저 나오는 쪽
  if(!await detail.count()) await choice.click()
  await detail.waitFor({timeout:10000})
  const href=await detail.getAttribute('href')
  assert.match(href,/^\/viec-lam\//)
  const owner=snapshot.find(j=>j.points.includes(target))
  if(groupSize===1) assert.equal(href,`/viec-lam/sb-${owner.id}`,'single-job marker opens that job')
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
}finally{await writeFile(out+'/map-style-requests.json',JSON.stringify(styleRequests,null,2)).catch(()=>{});await browser.close()}

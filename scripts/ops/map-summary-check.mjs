// Read-only production audit. Public source rows are an independent oracle.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import {hasExcludedMoneyRole} from '../../src/lib/jobPostingPolicy.mjs'
import {sourcePoints,assertPoints,pointsForJob,settleChange,classifyMapFailure} from './location-point-oracle.mjs'
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
const page=await context.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
// MAP-1 증거(#946): 지도 스타일 파일 요청의 실제 응답(상태·걸린 시간·주소)을 남긴다. 판정 기준은 바꾸지 않는다. 열쇠(apikey)는 가린다.
const styleRequests=[]
const isStyle=u=>/maps\.vietmap\.vn\/.*style\.json/.test(u)
const masked=u=>u.replace(/apikey=[^&]+/,'apikey=***')
page.on('requestfinished',async r=>{ if(!isStyle(r.url()))return; const res=await r.response().catch(()=>null); const t=r.timing(); styleRequests.push({at:new Date().toISOString(),page:page.url(),url:masked(r.url()),status:res?.status()??null,ms:t.responseEnd>=0?Math.round(t.responseEnd):null}) })
page.on('requestfailed',r=>{ if(isStyle(r.url()))styleRequests.push({at:new Date().toISOString(),page:page.url(),url:masked(r.url()),status:null,failure:r.failure()?.errorText??'failed'}) })
async function saveFailure(job,error) {
 const state=await page.evaluate(()=>{ const v=document.querySelector('.jd2-vmap'); return {mapText:v?.textContent?.trim().slice(0,120)??null,mapError:!!document.querySelector('.job-location-map__error'),planned:v?.getAttribute('data-planned-location-points')??null,unavailable:v?.getAttribute('data-map-unavailable')??null,markers:document.querySelectorAll('.jd2-vmap [data-location-points]').length} }).catch(()=>null)
 await page.screenshot({path:`${out}/failure-sb-${job.id}.png`,fullPage:false}).catch(()=>{})
 await writeFile(`${out}/failure-sb-${job.id}.json`,JSON.stringify({jobId:job.id,url:page.url(),error:String(error?.message??error).slice(0,300),state,styleRequests:styleRequests.slice(-6)},null,2)).catch(()=>{})
 console.log('MAP_FAILURE_EVIDENCE '+JSON.stringify({jobId:job.id,state,lastStyle:styleRequests.slice(-3)}))
 return state
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
 const externalUnavailable=[]
 for(const job of snapshot) {
  if(changed.has(job.id))continue
  const styleFrom=styleRequests.length   // 이 공고를 여는 동안의 지도 스타일 요청만 원인으로 본다
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
  } catch(e) {
   const state=await saveFailure(job,e)
   // 외부 지도(VietMap) 요청 실패와 우리 위치 데이터 오류를 가른다(classifyMapFailure). 외부 실패는 이 공고의 '화면에 그려짐'을 확인하지 못한 것으로 따로 남기고,
   // 데이터·핀 오류·원인을 못 가린 실패는 지금까지처럼 그대로 실패한다. 위치 데이터 자체(원본↔공개 캐시)는 위에서 모든 공고를 이미 독립 대조했다.
   const verdict=classifyMapFailure(e,{state,styleRequests:styleRequests.slice(styleFrom),points:job.points})
   if(verdict.external){externalUnavailable.push({jobId:job.id,reason:verdict.reason});console.log('EXTERNAL_MAP_UNAVAILABLE '+JSON.stringify({jobId:job.id,reason:verdict.reason}));continue}
   if(await settleChange(e,job,readFresh)==='changed'){changed.add(job.id);console.log('AUDIT_JOB_CHANGED '+job.id)}
  }
 }
 // 외부 지도 실패로 화면을 못 그린 공고도 있고 그려 본 공고가 한 건도 없으면 지도 서비스 전체 불가(또는 우리 쪽 문제)라 통과시키지 않는다.
 if(externalUnavailable.length && verifiedJobs.length===0) throw Error('지도를 그려서 확인한 공고가 한 건도 없음(외부 지도 실패 '+externalUnavailable.length+'건): '+externalUnavailable.map(x=>x.jobId).join(','))
 if(externalUnavailable.length) {
  const note='외부 지도(VietMap) 요청 실패로 화면 그려짐을 확인하지 못한 공고 '+externalUnavailable.length+'건('+externalUnavailable.map(x=>x.jobId).join(',')+') — 위치 데이터는 원본↔공개 캐시 대조로 확인됨, 그린 공고 '+verifiedJobs.length+'건 통과'
  console.log('::warning::'+note)
  if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### 지도 검사: 외부 지도 요청 실패\n- '+note+'\n')
 }
 const externalIds=new Set(externalUnavailable.map(x=>x.jobId))
 for(const job of snapshot) if(!changed.has(job.id)&&!externalIds.has(job.id)) assertPoints(job.points,pointsForJob([[...observed.values()]],job.id),'full observed main point set '+job.id)
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
 await writeFile(out+'/result.json',JSON.stringify({base,ok:true,publicJobs:snapshot.length,excludedByPublicAdmission:excluded,verifiedJobs,externalMapUnavailable:externalUnavailable,sourcePoints:snapshot.reduce((n,j)=>n+j.points.length,0),checks:['paginated independent public source','all main/group point sets','all detail point sets','kind precision revision','dynamic category selection','mobile summary absent']},null,2))
 console.log('PASS: independent public source, main and detail point sets agree')
}finally{await writeFile(out+'/map-style-requests.json',JSON.stringify(styleRequests,null,2)).catch(()=>{});await browser.close()}

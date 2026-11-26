// Browser-only synthetic fixtures. Never writes or publishes database rows.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {createMapLocationsHandler} from '../../api/map-locations.js'
import {sourcePoints,assertPoints,pointsForJob} from './location-point-oracle.mjs'
const base=process.env.BASE_URL||'http://localhost:4173'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'synthetic fixtures are local-only')
const out=process.env.SCREENSHOT_DIR||'/tmp/location-canonical-browser-fixtures'
await mkdir(out,{recursive:true})
const job=id=>({id,title:`Synthetic operator ${id}`,company:'Browser fixture only',description:'Operate production equipment. Browser-only regression.',category:'san_xuat_xay_dung',location:'Bắc Ninh',active:true,admin_hidden:false,posted_at:'2026-10-26',salary:'10 triệu',employer_phone:'0900000000',occupation_code:'8189',occupation_evidence:'Operate production equipment'})
const location=(id,jobId,kind,lat=21.1861,lng=106.0763)=>({id,job_id:jobId,raw_address:`Synthetic site ${id}, Bắc Ninh`,sort_order:id,lat,lng,point_kind:kind,point_precision:kind==='exact'?'building':kind==='gate'?'industrial_park_gate':'commune',point_revision:3,point_evidence:{source:'browser-only fixture',checkedAt:'2026-10-26T00:00:00Z'},location_verified:kind==='exact',coordinate_accuracy:kind==='exact'?'exact':'region',geocode_status:'success'})
const scenarios=[
 {name:'zero',jobs:[],locations:[]},
 {name:'one',jobs:[job(910001)],locations:[location(920001,910001,'exact')]},
 {name:'multi',jobs:[job(910002),job(910003)],locations:[location(920002,910002,'exact'),location(920003,910002,'area',21.187,106.078),location(920004,910003,'gate')]},
]
// 3순위 2차: migration-postgres 격리 DB에 migration을 적용한 결과(scripts/ci/isolated-db-fixture.sql)가 있으면 그것만 돈다
// (합성 0·1·여러 곳은 app-screen에서 이미 돈다). 시험 DB에 없는 화면용 칸(제목·연락처 등)과 0/빈 정확도·revision만 위 합성 기본값으로 채운다.
const dbDir=process.env.LOCATION_FIXTURE_DIR
if(dbDir) {
 scenarios.length=0
 const filled=(row,keys)=>Object.fromEntries(keys.filter(k=>row[k]!=null&&row[k]!=='').map(k=>[k,row[k]]))
 for(const f of (await readdir(dbDir)).filter(f=>f.endsWith('.json')).sort()) {
  const d=JSON.parse(await readFile(`${dbDir}/${f}`,'utf8'))
  const jobs=d.jobs.map(r=>({...job(Number(r.id)),...filled(r,['title','company','location','category','description','salary','employer_phone','occupation_code','occupation_evidence']),id:Number(r.id),active:true,admin_hidden:false}))
  const locations=d.locations.map(r=>{const t=location(Number(r.id),Number(r.job_id),r.point_kind);return {...t,...filled(r,['raw_address','sort_order','point_evidence','location_verified','coordinate_accuracy','geocode_status']),
   id:Number(r.id),job_id:Number(r.job_id),point_kind:r.point_kind,lat:r.lat==null?null:Number(r.lat),lng:r.lng==null?null:Number(r.lng),
   point_precision:r.point_precision||t.point_precision,point_revision:Number(r.point_revision)>=1?Number(r.point_revision):t.point_revision}})
  scenarios.push({name:'db-'+f.replace(/\.json$/,''),db:true,jobs,locations})
 }
 assert.ok(scenarios.length,'isolated DB fixture missing')
}
// 공개 위치 응답은 HEAD의 실제 처리 코드(api/map-locations.js)에 원본 줄을 넣어 만든다(운영은 DB 함수가 같은 원본을 읽음).
const apiFor=fixture=>{
 const handler=createMapLocationsHandler({read:async ids=>fixture.jobs.filter(j=>ids.includes(j.id)).map(j=>({job_id:j.id,source_points:sourcePoints(fixture.locations.filter(w=>w.job_id===j.id))}))})
 return async ids=>{let status=200,body=null;await handler({method:'GET',query:{ids}},{setHeader(){},status(s){status=s;return this},json(b){body=b;return this}});return {status,body}}
}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
const results=[]
try {
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
 for(const fixture of scenarios) {
  const proofName=`${fixture.name}-${viewport.width}`
  const context=await browser.newContext({viewport,isMobile:viewport.width<760,hasTouch:viewport.width<760})
  const errors=[]
  // 격리 DB 결과는 점마다 지도를 옮겨 보므로(아래) 처음 화면 위치를 고정하지 않는다.
  if(!fixture.db)await context.addInitScript(()=>localStorage.setItem('vgb:map-r1:viewport',JSON.stringify({center:{lat:21.1865,lng:106.077},zoom:16})))
  await context.route('**/rest/v1/**',async route=>{
   const url=new URL(route.request().url())
   const table=url.pathname.split('/').at(-1)
   let rows=table==='local_jobs'?fixture.jobs:table==='job_work_locations'?fixture.locations:[]
   // Honor source job filters, so the fixture tests preserve normal query semantics.
   for(const key of ['id','job_id']) {
    const filter=url.searchParams.get(key)
    if(filter?.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===filter.slice(3))
    if(filter?.startsWith('in.(')) {const ids=filter.slice(4,-1).split(',');rows=rows.filter(row=>ids.includes(String(row[key])))}
   }
   await route.fulfill({status:200,json:rows,headers:{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`}})
  })
  const style={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#eef2f6'}}]}
  await context.route('https://maps.geoapify.com/**',route=>route.fulfill({json:style}))
  // 11-21부터 화면이 우리 쪽 스타일 사본(/vietmap/styles/*.json)을 먼저 받아 그 안의 실제 타일·그림 주소로 간다 — 그림 요청에 JSON을 주면 지도 실패로 넘어가므로 그림은 빈 1×1 그림으로.
  const blankPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64')
  await context.route('https://maps.vietmap.vn/**',route=>route.request().resourceType()==='image'||/\.(png|jpe?g|webp)(\?|$)/.test(route.request().url())?route.fulfill({status:200,contentType:'image/png',body:blankPng}):route.fulfill({json:style}))
  const api=apiFor(fixture)
  await context.route('**/api/map-locations?**',async route=>{const r=await api(new URL(route.request().url()).searchParams.get('ids')||'');await route.fulfill({status:r.status,json:r.body})})
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  try {
   await page.goto(base,{waitUntil:'domcontentloaded'})
   await page.locator('.hme__map').scrollIntoViewIfNeeded()
   await page.waitForFunction(n=>{const counts=document.querySelector('[data-testid="home-map-job-counts"]');return counts && counts.getAttribute('data-loading')!=='true' && Number(counts.getAttribute('data-loaded'))===n},fixture.jobs.length,{timeout:30000})
   const expected=sourcePoints(fixture.locations)
   if(fixture.db) {
    // 공개 위치 응답 = 원본 확정 좌표(공고마다)
    for(const j of fixture.jobs) {const r=await api(String(j.id));assert.equal(r.status,200,fixture.name+' api status');assertPoints(sourcePoints(fixture.locations.filter(w=>w.job_id===j.id)),r.body.points[`sb-${j.id}`]??[],fixture.name+' api source set '+j.id)}
    // 지도 핀: 점마다 그 자리로 지도를 옮겨 그 공고·근무지 줄의 핀이 나오는지(map-summary-check와 같은 방식)
    for(const target of expected) {
     const owner=fixture.locations.find(w=>String(w.id)===String(target.workLocationId)).job_id
     await page.evaluate(p=>localStorage.setItem('vgb:map-r1:viewport',JSON.stringify({center:{lat:Number(p.lat),lng:Number(p.lng)},zoom:16})),target)
     await page.goto(base,{waitUntil:'domcontentloaded'})
     await page.locator('.hme__map').scrollIntoViewIfNeeded()
     await page.waitForFunction(({id,work})=>[...document.querySelectorAll('.hme-map [data-location-points]')].some(el=>JSON.parse(el.dataset.locationPoints).some(p=>String(p.jobId).replace(/^sb-/,'')===String(id)&&String(p.workLocationId)===String(work))),{id:owner,work:target.workLocationId},{timeout:30000})
     const shown=(await page.locator('.hme-map [data-location-points]').evaluateAll(els=>els.flatMap(el=>JSON.parse(el.dataset.locationPoints)))).filter(p=>String(p.workLocationId)===String(target.workLocationId))
     assertPoints([target],[shown[0]],fixture.name+' main pin '+target.workLocationId)
    }
    // 핀이 안 되는 줄(대략 위치 등)은 어디에도 핀으로 나오지 않는다
    const nopin=new Set(fixture.locations.filter(w=>!expected.some(e=>String(e.workLocationId)===String(w.id))).map(w=>String(w.id)))
    const all=await page.locator('.hme-map [data-location-points]').evaluateAll(els=>els.flatMap(el=>JSON.parse(el.dataset.locationPoints)))
    assert.ok(!all.some(p=>nopin.has(String(p.workLocationId))),fixture.name+' non-confirmed row shown as pin')
   } else {
    if(expected.length)await page.waitForFunction(n=>[...document.querySelectorAll('.hme-map [data-location-points]')].flatMap(el=>JSON.parse(el.dataset.locationPoints)).length===n,expected.length,{timeout:30000})
    else await page.locator('.hme-map__canvas').waitFor()
   const groups=await page.locator('.hme-map [data-location-points]').evaluateAll(els=>els.map(el=>JSON.parse(el.dataset.locationPoints)))
   assertPoints(expected,groups.flat(),fixture.name+' main full canonical set')
   for(const j of fixture.jobs) assertPoints(sourcePoints(fixture.locations.filter(w=>w.job_id===j.id)),pointsForJob(groups.map(g=>g.map(p=>({...p,jobId:String(p.jobId).replace(/^sb-/,'' )}))),j.id),fixture.name+' grouped job ownership')
   if(fixture.name==='multi') {
    assert.ok(groups.some(g=>new Set(g.map(p=>p.jobId)).size>1),'coincident jobs share a real grouped marker')
    // 여러 공고가 한 점에 겹친 마커(#934 후속): force 없이 눌러(덮이면 실패) 선택 목록이 열리고, 공고마다 그 공고의 상세가 열려야 한다.
    const groupedMarker=()=>page.locator('.hme-map [data-location-points]').filter({has:page.locator('.hme-map__job-count')}).first()
    const jobsInGroup=[...new Set(groups.filter(g=>new Set(g.map(p=>p.jobId)).size>1).flatMap(g=>g.map(p=>String(p.jobId).replace(/^sb-/,''))))].sort()
    assert.deepEqual(jobsInGroup,fixture.jobs.map(j=>String(j.id)).sort().filter(id=>jobsInGroup.includes(id)),'grouped marker holds fixture jobs only')
    assert.ok(jobsInGroup.length>=2,'grouped marker holds at least two jobs')
    const picker=page.locator('.hme-map__job-picker button')
    for(const id of jobsInGroup) {
     await groupedMarker().click()
     await picker.first().waitFor()
     assert.equal(await picker.count(),jobsInGroup.length,'every grouped job is selectable')
     await picker.filter({hasText:`Synthetic operator ${id}`}).click()
     const links=page.locator('.hme-job__actions a[href^="/viec-lam/"]')
     await page.locator(`.hme-job__actions a[href="/viec-lam/sb-${id}"]`).waitFor()  // 방금 고른 공고의 상세 주소(앞서 고른 공고의 것이 남아 있어도 통과하지 않음)
     assert.deepEqual(await links.evaluateAll(els=>els.map(el=>el.getAttribute('href'))),[`/viec-lam/sb-${id}`],`selecting grouped job ${id} opens only that job's detail`)
    }
   }
   }
   await page.screenshot({path:`${out}/${proofName}-main.png`})
   for(const j of fixture.jobs) {
    await page.goto(`${base}/viec-lam/sb-${j.id}`,{waitUntil:'domcontentloaded'})
    await page.locator('.jd2-page h1').waitFor()
    const points=sourcePoints(fixture.locations.filter(w=>w.job_id===j.id))
    await page.waitForFunction(n=>[...document.querySelectorAll('.jd2-vmap [data-location-points]')].flatMap(el=>JSON.parse(el.dataset.locationPoints)).length===n,points.length,{timeout:30000})
    const rendered=await page.locator('.jd2-vmap [data-location-points]').evaluateAll(els=>els.flatMap(el=>JSON.parse(el.dataset.locationPoints)))
    assertPoints(points,rendered,fixture.name+' detail complete source set '+j.id)
    await page.screenshot({path:`${out}/${proofName}-detail-${j.id}.png`})
   }
   assert.deepEqual(errors,[],fixture.name+' page errors')
   results.push({scenario:fixture.name,viewport,pass:true,jobs:fixture.jobs.length,points:expected.length})
  }finally{await context.close()}
 }
 }
}finally{await browser.close();await writeFile(`${out}/result.json`,JSON.stringify({kind:'synthetic-browser-only',base,results},null,2))}
console.log(JSON.stringify({kind:'synthetic-browser-only',results}))

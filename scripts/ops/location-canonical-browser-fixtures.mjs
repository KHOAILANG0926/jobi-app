// Browser-only synthetic fixtures. Never writes or publishes database rows.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
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
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
const results=[]
try {
 for(const fixture of scenarios) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  const errors=[]
  await context.addInitScript(()=>localStorage.setItem('vgb:map-r1:viewport',JSON.stringify({center:{lat:21.1865,lng:106.077},zoom:16})))
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
  await context.route('https://maps.vietmap.vn/**',route=>route.fulfill({json:style}))
  await context.route('**/api/map-locations?**',route=>route.fulfill({json:{points:Object.fromEntries(fixture.jobs.map(j=>[`sb-${j.id}`,sourcePoints(fixture.locations.filter(w=>w.job_id===j.id))]))}}))
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  try {
   await page.goto(base,{waitUntil:'domcontentloaded'})
   await page.locator('.hme__map').scrollIntoViewIfNeeded()
   await page.waitForFunction(n=>{const counts=document.querySelector('[data-testid="home-map-job-counts"]');return counts && counts.getAttribute('data-loading')!=='true' && Number(counts.getAttribute('data-loaded'))===n},fixture.jobs.length,{timeout:30000})
   const expected=sourcePoints(fixture.locations)
   if(expected.length)await page.waitForFunction(n=>[...document.querySelectorAll('.hme-map [data-location-points]')].flatMap(el=>JSON.parse(el.dataset.locationPoints)).length===n,expected.length,{timeout:30000})
   else await page.locator('.hme-map__canvas').waitFor()
   const groups=await page.locator('.hme-map [data-location-points]').evaluateAll(els=>els.map(el=>JSON.parse(el.dataset.locationPoints)))
   assertPoints(expected,groups.flat(),fixture.name+' main full canonical set')
   for(const j of fixture.jobs) assertPoints(sourcePoints(fixture.locations.filter(w=>w.job_id===j.id)),pointsForJob(groups.map(g=>g.map(p=>({...p,jobId:String(p.jobId).replace(/^sb-/,'' )}))),j.id),fixture.name+' grouped job ownership')
   if(fixture.name==='multi') {
    assert.ok(groups.some(g=>new Set(g.map(p=>p.jobId)).size>1),'coincident jobs share a real grouped marker')
    const grouped=page.locator('.hme-map [data-location-points]').filter({has:page.locator('.hme-map__job-count')}).first()
    await grouped.click({force:true})
    await page.locator('.hme-map__job-picker button').first().waitFor()
    assert.equal(await page.locator('.hme-map__job-picker button').count(),2,'both grouped jobs are selectable')
    await page.locator('.hme-map__job-picker button').first().click()
    await page.locator('.hme-job__actions').waitFor()
   }
   await page.screenshot({path:`${out}/${fixture.name}-main.png`})
   for(const j of fixture.jobs) {
    await page.goto(`${base}/viec-lam/sb-${j.id}`,{waitUntil:'domcontentloaded'})
    await page.locator('.jd2-page h1').waitFor()
    const points=sourcePoints(fixture.locations.filter(w=>w.job_id===j.id))
    await page.waitForFunction(n=>[...document.querySelectorAll('.jd2-vmap [data-location-points]')].flatMap(el=>JSON.parse(el.dataset.locationPoints)).length===n,points.length,{timeout:30000})
    const rendered=await page.locator('.jd2-vmap [data-location-points]').evaluateAll(els=>els.flatMap(el=>JSON.parse(el.dataset.locationPoints)))
    assertPoints(points,rendered,fixture.name+' detail complete source set '+j.id)
    await page.screenshot({path:`${out}/${fixture.name}-detail-${j.id}.png`})
   }
   assert.deepEqual(errors,[],fixture.name+' page errors')
   results.push({scenario:fixture.name,pass:true,jobs:fixture.jobs.length,points:expected.length})
  }finally{await context.close()}
 }
}finally{await browser.close();await writeFile(`${out}/result.json`,JSON.stringify({kind:'synthetic-browser-only',base,results},null,2))}
console.log(JSON.stringify({kind:'synthetic-browser-only',results}))

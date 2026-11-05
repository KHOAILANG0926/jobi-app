// Isolated public API fixtures only; no production accounts, SQL, or writes.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
const base = process.env.BASE_URL || 'http://127.0.0.1:4183'
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('local fixture server required')
const out = process.env.SCREENSHOT_DIR || '/tmp/map-no-webgl-proof'
mkdirSync(out,{recursive:true})
const job = { id:910080, title:'Trợ lý nhân sự thử nghiệm', company:'Map Browser Fixture', category:'van_phong', occupation_code:'4406', occupation_evidence:'Tuyển dụng và nhân sự', salary:'18.000.000đ/tháng', salary_period:'month', active:true, admin_hidden:false, posted_at:'2026-11-05', location:'Hà Nội', description:'Công việc\nTuyển dụng và nhân sự', employer_phone:'0900000000' }
const location = { id:910081, job_id:job.id, raw_address:'Hà Nội', lat:21.0285, lng:105.8542, point_kind:'area', point_precision:'area', point_revision:1, point_evidence:{source:'isolated browser fixture'}, location_verified:false, coordinate_accuracy:'region', sort_order:0 }
const widths=process.argv.length>2?process.argv.slice(2).map(Number):[1366,390]
assert(widths.every(width=>[1366,390].includes(width)),'supported test viewport')
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
try {
 for(const width of widths) for(const tilesAvailable of [true,false]) {
  const context=await browser.newContext({viewport:{width,height:950}})
  await context.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext
   HTMLCanvasElement.prototype.getContext=function(kind,...args) {
    if(['webgl','webgl2','experimental-webgl'].includes(kind))return null
    return original.call(this,kind,...args)
   }
  })
  await context.route('https://edhuesdnuxlbcfephutq.supabase.co/**',route=>{
   const url=new URL(route.request().url())
   const table=url.pathname.split('/').at(-1)
   const rows=table==='local_jobs'?[job]:table.includes('work_locations')?[location]:[]
   return route.fulfill({json:rows,headers:{'content-range':`0-${Math.max(rows.length-1,0)}/${rows.length}`}})
  })
  await context.route('**/api/map-locations?**',r=>r.fulfill({json:{points:{[`sb-${job.id}`]:[{...location,workLocationId:location.id,kind:'area',precision:'area',revision:1}]}}}))
  await context.route('https://maps.geoapify.com/**',route=>{
   if(route.request().url().includes('/tile/'))return tilesAvailable?route.fulfill({contentType:'image/png',body:readFileSync('public/logo.png')}):route.abort()
   return route.fulfill({json:{version:8,sources:{},layers:[]}})
  })
  const page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base,{waitUntil:'domcontentloaded'})
  await page.locator('.hme__map').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(2500)
  assert.equal(errors.length,0,`no uncaught GPU error at ${width}px: ${errors.join('; ')}`)
  const map=page.locator('.hme-map[data-map-provider="raster"]')
  await map.waitFor({state:'visible',timeout:15000})
  await page.waitForFunction(()=>Number.isFinite(Number(document.querySelector('[data-map-provider="raster"] .hme-map__canvas')?.dataset.mapZoom)))
  const marker=map.locator('.hme-map__job-marker').first()
  await marker.waitFor({state:'visible'})
  assert.equal(await marker.getAttribute('data-location-kind'),'area','approximate point keeps its accuracy label')
  assert((await marker.getAttribute('data-location-points')).includes('sb-910080'),'canonical job provenance stays on the marker')
  await marker.click()
  await page.locator('.hme-job__title').filter({hasText:job.title}).waitFor({state:'visible'})
  await page.locator(width < 760 ? '.hme-sheet__close' : '.hme-job__close').click()
  if(width<760) await page.getByRole('button',{name:'Mở bộ lọc bản đồ',exact:true}).click()
  await page.getByRole('button',{name:'15M+',exact:true}).click()
  if(width<760) await page.getByRole('button',{name:'Đóng bộ lọc',exact:true}).click()
  await marker.waitFor({state:'visible'})
  assert(await page.locator('header').count()>0,'site header remains mounted')
  if(!tilesAvailable) await map.locator('.hme-map__notice').waitFor({state:'visible'})
  await page.screenshot({path:`${out}/no-webgl-${width}-${tilesAvailable?'tiles':'no-tiles'}.png`})
  assert.equal(errors.length,0,'map/filter interactions do not unmount the page')
  await context.close()
  console.log(`PASS ${width}px WebGL unavailable, tiles=${tilesAvailable}: page, raster map, canonical marker, selection and salary filter`)
 }
} finally {await browser.close()}

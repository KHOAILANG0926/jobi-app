// Read-only check with real public postings; no sample jobs are published.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const base=process.env.BASE_URL||'http://localhost:4173'
const out=process.env.SCREENSHOT_DIR||'map-summary-proof'
await mkdir(out,{recursive:true})
const browser=await chromium.launch()
const context=await browser.newContext({viewport:{width:1440,height:1000},geolocation:{latitude:21.10,longitude:106.07,accuracy:20},permissions:['geolocation']})
await context.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}))
const local=new URL(base).hostname==='localhost'
if(local){
 await context.route('https://maps.geoapify.com/v1/styles/**',route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#eef2f6'}}]}}))
 await context.route('**/api/map-locations?**',async route=>{
  const u=new URL(route.request().url())
  const response=await context.request.get('https://www.viecganban.vn'+u.pathname+u.search)
  assert.equal(response.status(),200)
  await route.fulfill({response})
 })
}
const page=await context.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto(base,{waitUntil:'domcontentloaded'})
 await page.locator('.hme__map').scrollIntoViewIfNeeded()
 await page.locator('.hme').getByRole('button',{name:'20 km',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('[data-testid="map-summary-total"]')?.textContent==='2',undefined,{timeout:60000})
 assert.equal(await page.locator('[data-category="san_xuat_xay_dung"] strong').innerText(),'2')
 assert.equal(await page.locator('.hme-map-r1-results').count(),0,'PC long list replaced by summary')
 await page.locator('.hme').screenshot({path:out+'/summary-two-jobs.png'})
 await page.locator('[data-category="san_xuat_xay_dung"]').click()
 assert.equal(await page.locator('[data-category="san_xuat_xay_dung"]').getAttribute('aria-pressed'),'true')
 await page.getByRole('button',{name:'Bỏ lọc ngành',exact:true}).click()
 await page.locator('.hme').getByRole('button',{name:'100 m',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('[data-testid="map-summary-total"]')?.textContent==='0')
 assert.equal(await page.locator('.hme-map__job-marker').count(),2,'representative pins stay outside radius')
 await page.locator('.hme').screenshot({path:out+'/summary-radius-zero.png'})
 await page.locator('.hme').getByRole('button',{name:'20 km',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('[data-testid="map-summary-total"]')?.textContent==='2')
 await page.locator('.hme-map__job-marker[title*="KDA"]').click()
 assert.deepEqual(await page.locator('.hme-job__actions a').allTextContents(),['Xem chi tiết','Chỉ đường'])
 await page.locator('.hme-job__close').click()
 const box=await page.locator('.hme-map__canvas').boundingBox()
 await page.mouse.move(box.x+box.width-40,box.y+box.height/2)
 await page.mouse.down()
 await page.mouse.move(box.x+40,box.y+box.height/2,{steps:25})
 await page.mouse.up()
 await page.waitForFunction(()=>document.querySelector('[data-testid="map-summary-total"]')?.textContent==='0')
 await page.locator('.hme').screenshot({path:out+'/summary-panned-zero.png'})
 assert.deepEqual(errors,[])
 await page.setViewportSize({width:390,height:844})
 await page.waitForFunction(()=>!document.querySelector('[data-testid="map-area-summary"]'))
 await page.screenshot({path:out+'/mobile-unchanged.png'})
 await writeFile(out+'/result.json',JSON.stringify({base,local,ok:true,checks:['real jobs 2','industry count 2','industry filter/reset','radius 0','representative pins preserved','pin B actions','pan 0','mobile summary absent']},null,2))
 console.log('map summary browser checks passed')
}finally{await context.unrouteAll({behavior:'wait'});await browser.close()}

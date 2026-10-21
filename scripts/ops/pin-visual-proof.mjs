// Read-only production capture; no app/data/style replacement.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
mkdirSync('out', { recursive: true })
const browser = await chromium.launch()
const results = []
try {
for (const [name,width,height] of [['mobile',390,844],['pc',1366,900]]) {
  const context = await browser.newContext({viewport:{width,height},isMobile:width<760,hasTouch:width<760,
    geolocation:{latitude:21.10,longitude:106.07,accuracy:20},permissions:['geolocation'],locale:'vi-VN'})
  await context.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}))
  const page = await context.newPage()
  const mapResponses = []
  page.on('response', response=>{
    const u=new URL(response.url())
    if(/vietmap/.test(u.hostname)) mapResponses.push({path:u.pathname,status:response.status()})
  })
  await context.route('**/api/map-locations?**',async route=>{
    const response=await route.fetch()
    await page.waitForFunction(()=>document.querySelector('.hme')?.textContent.includes('Vị trí hiện tại của bạn'))
    await route.fulfill({response})
  })
  await page.goto('https://www.viecganban.vn/',{waitUntil:'domcontentloaded'})
  await page.locator('.hme__map').scrollIntoViewIfNeeded()
  await page.waitForFunction(()=>{
    const box=document.querySelector('.hme-map__canvas')?.getBoundingClientRect()
    const pins=[...document.querySelectorAll('.hme-map__job-marker')]
    return box&&pins.length===2&&pins.every(p=>{const r=p.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom})
  },undefined,{timeout:60000})
  // Previous evidence was taken before tiles arrived. Wait for network settlement and tile paint.
  await page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{})
  await page.waitForTimeout(15000)
  await page.screenshot({path:`out/${name}-overview.png`})
  await page.locator('.hme__map').screenshot({path:`out/${name}-map.png`})
  const labels=await page.locator('.hme-map__job-marker').evaluateAll(es=>es.map(e=>e.title))
  for(const [key,pattern] of [['kda',/KDA/i],['cable',/dây mạng/i]]) {
    await page.locator('.hme-map__job-marker').filter({hasText:'not-used'}).count() // no mutation
    await page.getByRole('button',{name:pattern}).click()
    await page.waitForTimeout(800)
    await page.screenshot({path:`out/${name}-${key}.png`})
    if(width<760) {
      const close=page.getByRole('button',{name:/Đóng/i})
      if(await close.count()) await close.first().click()
      else await page.keyboard.press('Escape')
    }
  }
  assert.equal(await page.locator('[data-map-provider]').getAttribute('data-map-provider'),'vietmap')
  results.push({name,labels,mapResponses})
  await context.close()
}
} finally {
  await browser.close()
  writeFileSync('out/result.json',JSON.stringify(results,null,2))
  console.log(JSON.stringify(results,null,2))
}

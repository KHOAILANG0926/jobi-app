// Read-only composition check. Matching real postings will be checked after data accumulates.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
const base=process.env.BASE_URL||'http://localhost:4173'
const out=process.env.SCREENSHOT_DIR||'menu-search-proof'
mkdirSync(out,{recursive:true})
const browser=await chromium.launch()
const checks=[]
try {
 for(const width of [1366,390]) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390,permissions:[]})
  const page=await context.newPage()
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const panel=page.locator('#home-job-filters')
  const duration=panel.getByRole('combobox',{name:'Thời gian làm việc',exact:true})
  const pledge=panel.getByRole('checkbox',{name:'Có cam kết hợp đồng / BHXH',exact:true})
  const verify=async (selected='',checked=false)=>{
   await page.waitForFunction(({selected,checked})=>{
    const p=new URL(location.href).searchParams
    const root=document.querySelector('#home-job-filters')
    return location.pathname==='/' && root?.querySelector('select')?.value===selected
     && root?.querySelector('input[type=checkbox]')?.checked===checked
     && (p.get('duration')||'')===selected && (p.get('pledge')==='1')===checked
   },{selected,checked},{timeout:45000})
   await panel.getByRole('status').filter({hasText:/\d+ việc làm/}).waitFor({timeout:45000})
   assert.equal(await panel.getByRole('checkbox',{name:'Chỉ tuyển gấp',exact:true}).count(),0)
   assert.equal(await panel.evaluate(el=>{
    const card=document.querySelector('.discovery-featured, .home-discovery-section, .home-featured, .home-section')
    return Boolean(card && el.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING)
   }),true,'conditions precede existing home job listings')
  }
  const menu=async name=>{
   await page.getByRole('button',{name:'Mở danh mục Việc làm',exact:true}).hover()
   await page.getByRole('button',{name,exact:true}).click()
  }
  await page.goto(base+'/',{waitUntil:'domcontentloaded'})
  await panel.waitFor()
  if(width===1366)await menu('Một ngày')
  else await page.goto(base+'/?duration='+encodeURIComponent('Một ngày')+'#home-job-filters',{waitUntil:'domcontentloaded'})
  await verify('Một ngày')
  // Menu entry brings the condition panel into view below the sticky header.
  await page.waitForFunction(()=>{
   const r=document.querySelector('#home-job-filters')?.getBoundingClientRect()
   const bottom=Math.max(0,...[...document.querySelectorAll('.layout__header, .home-mobile-header')].map(e=>e.getBoundingClientRect().bottom))
   return r && r.top>=bottom-2 && r.top<innerHeight-100
  },null,{timeout:15000})
  await page.screenshot({path:out+`/viewport-${width}.png`})
  await panel.screenshot({path:out+`/duration-${width}.png`})
  if(width===1366){
   await menu('Dưới 1 tuần');await verify('Dưới 1 tuần')
   await menu('🤝 Có cam kết hợp đồng / BHXH');await verify('',true)
  }else {
   await duration.selectOption('');await verify()
   await pledge.click();await verify('',true)
  }
  if(await panel.locator('.home-job-filters__notice').count()) {
   const cards=page.locator(width===1366 ? '.jc[data-job-id]' : '.discovery-job')
   assert.ok(await cards.count()>0,'zero condition matches retain the existing actual postings')
  }
  await panel.screenshot({path:out+`/pledge-${width}.png`})
  // Combining and clearing filters stays on Home and changes the visible summary.
  await duration.selectOption('Một ngày');await verify('Một ngày',true)
  await panel.getByRole('button',{name:'Xóa điều kiện',exact:true}).click();await verify()
  assert.equal(await panel.getByRole('button',{name:'Xóa điều kiện',exact:true}).count(),0)
  if(width===1366){
   const salary=page.locator('.hme__controls').getByRole('button',{name:'30M+',exact:true})
   await salary.click()
   await page.waitForFunction(()=>[...document.querySelectorAll('.hme-chip')].some(e=>e.textContent.trim()==='30M+'&&e.getAttribute('aria-pressed')==='true'))
   await salary.click()
   assert.equal(await salary.getAttribute('aria-pressed'),'true','re-click keeps the selected salary threshold')
   await page.locator('.hme').screenshot({path:out+'/salary-30M.png'})
   await menu('🔥 Tuyển gấp');await page.waitForURL('**/viec-lam/tuyen-gap')
  }
  assert.deepEqual(errors,[])
  checks.push({width,ok:true,scope:'home condition controls, placement, menu route, combine and clear; real matching-data acceptance deferred'})
  await context.close()
 }
}finally {await browser.close();writeFileSync(out+'/result.json',JSON.stringify({base,checks},null,2))}
console.log(JSON.stringify(checks))

// Browser-only auth/API fixtures; exercises the real desktop layout and existing search page.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base=(process.env.BASE_URL||'http://localhost:4173').replace(/\/$/,'')
const out=process.env.SCREENSHOT_DIR||'/tmp/desktop-header-a'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
try {
for(const role of ['guest','employer']) {
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 if(role==='employer') {
  const user={id:'00000000-0000-4000-8000-000000000003',email:'demo-employer@example.invalid',user_metadata:{name:'Demo Employer',role:'employer'},app_metadata:{},aud:'authenticated',role:'authenticated'}
  const exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url')
  const session={user,access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,exp,role:'authenticated'})+'.fixture',refresh_token:'browser-fixture',expires_at:exp,expires_in:3600,token_type:'bearer'}
  await context.addInitScript(s=>localStorage.setItem('sb-edhuesdnuxlbcfephutq-auth-token',JSON.stringify(s)),session)
  await context.route('**/auth/v1/**',r=>r.fulfill({json:user}))
 }
 await context.route('**/rest/v1/**',r=>r.fulfill({json:[]}))
 await context.route('**/api/**',r=>r.fulfill({json:[]}))
 const page=await context.newPage();page.setDefaultTimeout(12000)
 await page.goto(base+'/',{waitUntil:'domcontentloaded'})
 const input=page.getByRole('textbox',{name:'Tìm việc gần bạn'})
 await input.waitFor()
 assert.equal(await input.getAttribute('placeholder'),'Tìm việc gần bạn: ngành, công ty, KCN...')
 const styles=await page.evaluate(()=>{
  const css=s=>getComputedStyle(document.querySelector(s))
  return {post:css('.header-tabs__post-wrap').backgroundColor,line:css('.header-tabs').borderBottomColor,lineWidth:css('.header-tabs').borderBottomWidth,radius:css('.desktop-header-search').borderRadius,
   active:css('.header-tab--active').color,inactive:css('.header-tab:not(.header-tab--active)').color,overflow:document.documentElement.scrollWidth>innerWidth}
 })
 assert.equal(styles.post,'rgb(229, 57, 53)');assert.equal(styles.line,'rgb(229, 57, 53)');assert.equal(styles.lineWidth,'2px');assert.equal(styles.radius,'0px');assert.equal(styles.active,'rgb(229, 57, 53)');assert.notEqual(styles.inactive,styles.active);assert.equal(styles.overflow,false)
 const searchBox=await input.boundingBox(),brand=await page.locator('.header-top__brand').boundingBox(),actions=await page.locator('.header-tabs__actions').boundingBox()
 assert.ok(searchBox.x>=brand.x+brand.width&&searchBox.x+searchBox.width<=actions.x,'search overlaps logo/actions')
 await page.screenshot({path:`${out}/pc-${role}.png`,clip:{x:0,y:0,width:1440,height:500},animations:'disabled'})
 await input.fill('KDA Bắc Ninh');await input.press('Enter')
 await page.waitForURL(url=>url.pathname==='/viec-lam/tim-kiem'&&url.searchParams.get('q')==='KDA Bắc Ninh')
 await page.locator('.jobs-menu-page').waitFor()
 await page.locator('.header-tabs__nav .header-tab--active').waitFor()
 assert.match(await page.locator('.header-tabs__nav .header-tab--active').innerText(),/Việc làm/)
 assert.equal(await input.inputValue(),'KDA Bắc Ninh')
 await page.goBack();await page.getByRole('textbox',{name:'Tìm việc gần bạn'}).waitFor()
 for(const width of [1024,1366]) {await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'desktop overflow '+width)}
 console.log('PASS A desktop layout, existing keyword search:',role)
 await context.close()
}
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage()
await context.route('**/rest/v1/**',r=>r.fulfill({json:[]}));await context.route('**/api/**',r=>r.fulfill({json:[]}))
await page.goto(base+'/dang-nhap',{waitUntil:'domcontentloaded'})
await page.locator('.header-tabs__actions').getByRole('link',{name:'Đăng nhập',exact:true}).waitFor()
assert.equal(await page.locator('.desktop-header-search').count(),0)
assert.equal(await page.locator('.header-tabs__post-wrap').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(16, 185, 129)')
console.log('PASS mobile unchanged')
await context.close()
} finally {await browser.close()}

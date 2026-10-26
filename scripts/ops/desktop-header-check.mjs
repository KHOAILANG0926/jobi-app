// Actual browser UI with isolated auth/API fixtures; no production accounts or DB writes.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base=(process.env.BASE_URL||'http://localhost:4173').replace(/\/$/,'')
const out=process.env.SCREENSHOT_DIR
if(out) await mkdir(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
const links=[['+ Đăng tin mới','/dang-tin'],['Tin đã đăng','/bang-dieu-khien?tab=jobs'],['Quản lý ứng viên','/bang-dieu-khien?tab=applicants'],['Tin nhắn','/bang-dieu-khien?tab=messages']]
function auth(role) {
  const user={id:'00000000-0000-4000-8000-000000000002',email:'header-fixture@example.invalid',user_metadata:{name:role==='employer'?'Browser Employer':'Browser Seeker',role},app_metadata:{},aud:'authenticated',role:'authenticated'}
  const exp=Math.floor(Date.now()/1000)+3600, enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url')
  return {user,access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,exp,role:'authenticated'})+'.fixture',refresh_token:'browser-fixture',expires_at:exp,expires_in:3600,token_type:'bearer'}
}
try {
for(const role of ['guest','seeker','employer']) {
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 const session=auth(role==='guest'?'employer':role)
 let loggedIn=role!=='guest'
 if(loggedIn) await context.addInitScript(s=>localStorage.setItem('sb-edhuesdnuxlbcfephutq-auth-token',JSON.stringify(s)),session)
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  const json=data=>route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}})
  if(url.pathname.includes('/auth/v1/token')) {loggedIn=true;return json(session)}
  if(url.pathname.includes('/auth/v1/')) return json(session.user)
  if(url.pathname.includes('/rest/v1/')) return json(url.pathname.endsWith('/account_roles')&&loggedIn&&session.user.user_metadata.role==='employer'?[{role:'employer'}]:[])
  if(url.pathname.startsWith('/api/')) return json([])
  if(url.origin!==new URL(base).origin) return route.abort()
  return route.continue()
 })
 const page=await context.newPage();page.setDefaultTimeout(10000)
 await page.goto(base+'/')
 const actions=page.locator('.header-tabs__actions')
 if(role==='guest') {
  await actions.getByRole('link',{name:'Đăng nhập / Đăng ký',exact:true}).waitFor()
  assert.equal(await actions.locator('.btn-zalo-header,.header-tabs__signup').count(),0)
  assert.equal(await actions.locator(':scope > *').count(),3)
 } else {
  await actions.getByRole('link',{name:session.user.user_metadata.name,exact:true}).waitFor()
  assert.equal(await actions.getByRole('button',{name:'Đăng xuất',exact:true}).count(),1)
  assert.equal(await actions.locator('.notif-bell').count(),1)
 }
 assert.equal(await actions.getByRole('link',{name:'Đăng CV',exact:true}).getAttribute('href'),'/ho-so?tab=cv')
 const arrow=actions.getByRole('button',{name:'Mở menu nhà tuyển dụng',exact:true})
 await arrow.click()
 const menu=page.locator('#employer-header-menu')
 await menu.waitFor()
 await menu.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)))
 for(const [name,href] of links) assert.equal(await menu.getByRole('link',{name,exact:true}).getAttribute('href'),href)
 const bounds=await menu.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=1440,'menu clipped at screen edge')
 if(out) await page.screenshot({path:`${out}/desktop-${role}.png`})
 await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'})
 await arrow.click();await page.locator('.header-top__brand').click();await menu.waitFor({state:'hidden'})
 await arrow.click();await menu.getByRole('link',{name:'Tin nhắn',exact:true}).click()
 if(role==='guest') {
  await page.waitForURL(/dang-nhap/)
  assert.equal(new URL(page.url()).searchParams.get('redirect'),'/bang-dieu-khien?tab=messages')
  const zalo=page.getByRole('button',{name:'Tiếp tục với Zalo',exact:true})
  if(await page.locator('.btn-zalo-login').count()) {
   await zalo.waitFor();assert.ok(await zalo.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('input[type=email]'))&Node.DOCUMENT_POSITION_FOLLOWING)))
   if(out) await page.screenshot({path:`${out}/desktop-login.png`})
  }
  await page.locator('input[type=email]').fill(session.user.email)
  await page.locator('input[type=password]').fill('browser-fixture-only')
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()
 }
 if(role!=='seeker') {
  await page.waitForURL(/bang-dieu-khien\?tab=messages/)
  await page.getByRole('tab',{name:/Tin nhắn/}).waitFor()
  assert.equal(await page.getByRole('tab',{name:/Tin nhắn/}).getAttribute('aria-selected'),'true')
  for(const [name,tab] of [['Tin đã đăng','jobs'],['Quản lý ứng viên','applicants'],['Tin nhắn','messages']]) {
   await arrow.click();await menu.getByRole('link',{name,exact:true}).click()
   await page.waitForURL(url=>url.searchParams.get('tab')===tab)
   await page.getByRole('tab',{name:new RegExp(tab==='jobs'?'Tin tuyển dụng':tab==='applicants'?'Ứng viên':'Tin nhắn'),selected:true}).waitFor()
  }
  await page.reload();await page.getByRole('tab',{name:/Tin nhắn/,selected:true}).waitFor()
 } else await page.waitForURL(base+'/')
 console.log('PASS PC header, dropdown and navigation:',role)
 await context.close()
}
// Mobile uses a separate layout. Keep its header and login Zalo label/placement.
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage()
await page.route('**/*',route=>{const u=new URL(route.request().url());return u.pathname.startsWith('/api/')||u.pathname.includes('/rest/v1/')?route.fulfill({json:[]}):u.origin!==new URL(base).origin?route.abort():route.continue()})
await page.goto(base+'/dang-nhap',{waitUntil:'domcontentloaded'})
await page.getByRole('heading',{name:'Đăng nhập',exact:true}).waitFor()
await page.locator('.header-tabs__actions').getByRole('link',{name:'Đăng nhập',exact:true}).waitFor()
assert.equal(await page.locator('.header-tabs__signup').innerText(),'Đăng ký')
assert.equal(await page.locator('.header-tabs__post').innerText(),'Tuyển dụng')
assert.equal(await page.locator('#employer-header-menu').count(),0)
if(await page.locator('.btn-zalo-login').count()) await page.getByRole('button',{name:'Đăng nhập bằng Zalo',exact:true}).waitFor()
if(out) await page.screenshot({path:`${out}/mobile-unchanged.png`})
console.log('PASS mobile header/login unchanged')
await context.close()
} finally {await browser.close()}

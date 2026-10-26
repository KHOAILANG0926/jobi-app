// Read-only production browser verification. No session injection, login credentials or DB writes.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const base=(process.env.BASE_URL||'https://www.viecganban.vn').replace(/\/$/,''),out=process.env.SCREENSHOT_DIR||'/tmp/header-production'
await mkdir(out,{recursive:true})
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
try {
const p=await b.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(15000)
await p.goto(base+'/',{waitUntil:'domcontentloaded'})
await p.getByRole('link',{name:'Đăng nhập / Đăng ký',exact:true}).waitFor()
const actions=p.locator('.header-tabs__actions');assert.equal(await actions.locator(':scope > *').count(),3)
const arrow=actions.getByRole('button',{name:'Mở menu nhà tuyển dụng',exact:true})
await arrow.click();const menu=p.locator('#employer-header-menu');await menu.waitFor()
for(const [name,to] of [['+ Đăng tin mới','/dang-tin'],['Tin đã đăng','/bang-dieu-khien?tab=jobs'],['Quản lý ứng viên','/bang-dieu-khien?tab=applicants'],['Tin nhắn','/bang-dieu-khien?tab=messages']]) assert.equal(await menu.getByRole('link',{name,exact:true}).getAttribute('href'),to)
await p.screenshot({path:out+'/live-guest-menu.png',clip:{x:0,y:0,width:1440,height:350},animations:'disabled'})
await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'})
await arrow.click();await p.locator('.header-top__brand').click();await menu.waitFor({state:'hidden'})
await arrow.click();await menu.getByRole('link',{name:'Tin nhắn',exact:true}).click()
await p.waitForURL(/dang-nhap/);await p.getByRole('heading',{name:'Đăng nhập',exact:true}).waitFor()
assert.equal(new URL(p.url()).searchParams.get('redirect'),'/bang-dieu-khien?tab=messages')
const zalo=p.getByRole('button',{name:/Tiếp tục với Zalo/})
const zaloCount=await p.locator('.btn-zalo-login').count()
if(zaloCount) {await zalo.waitFor();assert.ok(await zalo.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('input[type=email]'))&Node.DOCUMENT_POSITION_FOLLOWING)))}
await p.screenshot({path:out+'/live-login.png',animations:'disabled'})
console.log('PASS live guest 3 actions, 4 menu links, Esc/outside close, employer login redirect, Zalo top:',zaloCount===1?'visible':'hidden (no app ID in served build)')
const m=await b.newPage({viewport:{width:390,height:844}})
await m.goto(base+'/dang-nhap',{waitUntil:'domcontentloaded'})
await m.locator('.header-tabs__actions').getByRole('link',{name:'Đăng nhập',exact:true}).waitFor()
assert.equal(await m.locator('.header-tabs__signup').innerText(),'Đăng ký')
assert.equal(await m.locator('.header-tabs__post').innerText(),'Tuyển dụng')
await m.screenshot({path:out+'/live-mobile-unchanged.png',animations:'disabled'})
console.log('PASS live mobile original header')
} finally {await b.close()}

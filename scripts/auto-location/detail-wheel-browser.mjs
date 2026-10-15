import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']})
const ctx=await browser.newContext({viewport:{width:1366,height:900}})
const job={id:1,title:'Synthetic wheel test',company:'Synthetic fixture',location:'Hà Nội',salary:'15 triệu/tháng',category:'dich_vu',active:true,admin_hidden:false,employer_phone:'0900000000',description:'Synthetic test only',posted_at:'2026-10-15',source:'manual:poster'}
await ctx.route('**/*',route=>{
 const u=new URL(route.request().url());const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)})
 if(u.hostname==='maps.vietmap.vn')return json({version:8,sources:{openmaptiles:{type:'vector',tiles:[]}},layers:[{id:'background',type:'background',paint:{'background-color':'#eee'}}]})
 if(u.hostname.endsWith('supabase.co')){
  if(u.pathname.endsWith('/local_jobs'))return json([job])
  if(u.pathname.endsWith('/job_work_locations'))return json([{id:1,job_id:1,raw_address:'Hà Nội',lat:21.0285,lng:105.8542,location_verified:true,coordinate_accuracy:'exact',sort_order:0}])
  return json([])
 }
 if(u.hostname==='127.0.0.1')return route.continue()
 return route.abort()
})
const page=await ctx.newPage()
await page.goto('http://127.0.0.1:5173/viec-lam/sb-1')
const canvas=page.locator('.jd2-vmap canvas').first()
await canvas.waitFor()
await canvas.scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
const pin=page.locator('.jd2-vmap .vietmapgl-marker').first()
await pin.waitFor()
const before={scroll:await page.evaluate(()=>scrollY),pin:await pin.boundingBox()}
const box=await canvas.boundingBox()
await page.mouse.move(box.x+box.width*0.7,box.y+box.height*0.7)
await page.mouse.wheel(0,-350)
await page.waitForTimeout(700)
const after={scroll:await page.evaluate(()=>scrollY),pin:await pin.boundingBox()}
assert(Math.abs(after.scroll-before.scroll)<2,`wheel scrolled page ${before.scroll} → ${after.scroll}`)
assert(Math.abs(after.pin.x-before.pin.x)>2||Math.abs(after.pin.y-before.pin.y)>2,'wheel must zoom map about cursor')
console.log('detail map: wheel zooms map and preserves page scroll position')
await browser.close()

// Synthetic public API responses only. Never reads/writes operational data.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync} from 'node:fs'
import {BOMUNTTL_SOURCE,BOMUNTTL_CONTEXT} from '../../src/lib/jobMultiRole.fixtures.ts'
import {buildDescriptionFromSources} from '../../src/lib/jobDescriptionBuild.ts'
const current=process.env.BASE_URL||'http://127.0.0.1:4173'
const baseline=process.env.BASELINE_URL||'http://127.0.0.1:4174'
for(const base of [current,baseline])assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'local-only fixture')
// Lee 2026-10-29: 기준 공고(KDA, sb-4824)는 기존 승인 틀 그대로 — 같은 번호로 기준 틀 비교.
const kda={id:4824,title:'CTY KDA tuyển nam, nữ làm linh kiện tai nghe',company:'CTY KDA',category:'san_xuat_xay_dung',salary:'310k/11h ca ngày, 360k/11h ca đêm',location:'KCN Yên Phong, Bắc Ninh',hours:'11h',work_period:'Toàn thời gian',work_days:'Theo ca',num_hires:'20',employer_phone:'0877880756',active:true,admin_hidden:false,posted_at:'2026-10-13',description:'Công việc\nLàm ngồi linh kiện tai nghe.\nYêu cầu\nTuyển nam, nữ (14-50 tuổi).\nThu nhập\nCa ngày: 310k/11h.\nCa đêm: 360k/11h.\nQuyền lợi\nCó xe đưa đón.'}
const description=buildDescriptionFromSources([{name:'source_text',text:BOMUNTTL_SOURCE}],BOMUNTTL_CONTEXT).description
const multi={...kda,id:910002,title:BOMUNTTL_CONTEXT.title,company:'Bomunttl',category:'am_thuc_do_uong',salary:'Theo vị trí — xem chi tiết',location:BOMUNTTL_CONTEXT.addresses[0],hours:null,work_period:null,work_days:null,num_hires:null,meal_provided:true,employer_phone:'0365447485',description}
const locations=job=>[{id:920001,job_id:job.id,raw_address:job.location,lat:21.1861,lng:106.0763,point_kind:'area',point_precision:'area',point_revision:1,point_evidence:{source:'synthetic browser fixture',checkedAt:'2026-10-28T00:00:00Z'},location_verified:false,coordinate_accuracy:'region',sort_order:0}]
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
mkdirSync('/tmp/multi-role-browser',{recursive:true})
async function open(base,job,width,imageState='none') {
 const context=await browser.newContext({viewport:{width,height:950}})
 await context.route('https://edhuesdnuxlbcfephutq.supabase.co/**',async route=> {
  const url=new URL(route.request().url())
  if(url.pathname.includes('/storage/')) {
   if(imageState==='loaded')return route.fulfill({contentType:'image/png',body:readFileSync('public/logo.png')})
   return route.abort()
  }
  const table=url.pathname.split('/').at(-1)
  const rows=table==='local_jobs'?[job]:table==='job_work_locations'?locations(job):[]
  await route.fulfill({json:rows,headers:{'content-range':`0-${Math.max(rows.length-1,0)}/${rows.length}`}})
 })
 const style={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#eef2f6'}}]}
 await context.route('https://maps.geoapify.com/**',r=>r.fulfill({json:style}))
 await context.route('https://maps.vietmap.vn/**',r=>r.fulfill({json:style}))
 await context.route('**/api/map-locations?**',r=>r.fulfill({json:{points:{[`sb-${job.id}`]:locations(job).map(w=>({workLocationId:w.id,lat:w.lat,lng:w.lng,kind:w.point_kind,precision:w.point_precision,revision:w.point_revision}))}}}))
 const page=await context.newPage()
 page.on('pageerror',e=>console.log(`::error title=page error ${new URL(base).port}::${String(e.stack||e).replace(/\n/g,' | ').slice(0,900)}`))
 page.on('console',m=>{ if(m.type()==='error') console.log(`::warning title=console ${new URL(base).port}::${m.text().slice(0,400)}`) })
 await page.goto(`${base}/viec-lam/sb-${job.id}`,{waitUntil:'domcontentloaded'})
 // 첫 화면은 개발 서버가 처음 파일을 묶는 동안(두 서버 동시) 20초를 넘길 수 있다 → 기다리는 시간만 늘림. 비교 내용은 같음.
 // 2026-10-30: 첫 화면(개발 서버 첫 준비)에서 90초를 넘기는 경우가 반복돼(#314·#315·#322·#328, 모두 첫 open) 한 번만 새로고침 후 다시 기다린다. 비교 내용은 같음.
 try { await page.locator('h1.jd2-header__title').waitFor({timeout:90000}) }
 catch { await page.reload({waitUntil:'domcontentloaded'}); await page.locator('h1.jd2-header__title').waitFor({timeout:90000}) }
 await page.evaluate(()=>document.fonts.ready)
 return {page,context}
}
async function checkHeaderPhotoZoom(page,width,state) {
 const trigger=page.locator('.jd2-header button.jd2-logo')
 assert.equal(await trigger.count(),1,'header photo is an accessible button')
 const before=await frame(page)
 const src=await trigger.locator('img').getAttribute('src')
 await trigger.click()
 const dialog=page.getByRole('dialog',{name:'Ảnh CTY KDA'})
 await dialog.waitFor({state:'visible'})
 assert.equal(await dialog.locator('img').getAttribute('src'),src,'zoom shows the original representative image')
 // 2026-11-09: 크기를 재기 전에 확대 그림이 다 읽힐 때까지 기다린다(크기 지정 없는 img라 읽히기 전 폭 0 → 개발 서버가 빠를 때 1366/none에서 연속 실패, #578). 판정 기준(>52px)은 그대로.
 await dialog.locator('img').evaluate(img=>img.decode().catch(()=>undefined))
 assert(await dialog.locator('img').evaluate(img=>img.getBoundingClientRect().width)>52,'photo is displayed larger')
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','zoom locks background scroll')
 await page.screenshot({path:`/tmp/multi-role-browser/header-photo-${width}-${state}.png`})
 await page.keyboard.press('Escape')
 await dialog.waitFor({state:'hidden'})
 assert(await trigger.evaluate(el=>el===document.activeElement),'closing restores focus')
 await page.keyboard.press('Enter')
 await dialog.waitFor({state:'visible'})
 await dialog.getByRole('button',{name:'Đóng',exact:true}).click()
 await dialog.waitFor({state:'hidden'})
 await trigger.click()
 await dialog.click({position:{x:5,y:5}})
 await dialog.waitFor({state:'hidden'})
 assert.deepEqual(await frame(page),before,'zoom leaves the detail frame unchanged')
}
async function frame(page) {
 return page.evaluate(()=> {
  const round=n=>Math.round(n*10)/10
  const header=document.querySelector('.jd2-header').getBoundingClientRect()
  const sections=Object.fromEntries(['.jd2-header','.jd2-sec--conditions-grid','.jd2-sec--recruit-grid','.jd2-detail-sections'].map(selector=> {
   const box=document.querySelector(selector)?.getBoundingClientRect()
   return [selector,box?[box.x,box.width,box.height].map(round):null]
  }))
  const parts=Object.fromEntries(['.jd2-logo','.jd2-header__info','.jd2-header__title'].map(selector=> {
   const box=document.querySelector('.jd2-header '+selector)?.getBoundingClientRect()
   return [selector,box?[box.x-header.x,box.y-header.y,box.width,box.height].map(round):null]
  }))
  return {...sections,headerParts:parts,headerGap:getComputedStyle(document.querySelector('.jd2-header__left')).gap}
 })
}
try {
 for(const width of [390,1366]) {
  for(const state of ['none','loaded','failed']) {
   const job={...kda,image_url:state==='none'?null:'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/test.png'}
   // Lee 요청: 사진 없는 공고도 업종 사진 표시. 이전 none은 로고 DOM이 없어 높이가 달랐다.
   // 같은 사진 존재 상태에서 기존 승인 로고 칸·제목·간격을 비교한다. loaded/failed는 기존 동일 입력 유지.
   const baselineJob=state==='none'?{...job,image_url:'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/test.png'}:job
   const before=await open(baseline,baselineJob,width,state==='none'?'loaded':state),after=await open(current,job,width,state)
   if(state==='none') {
    const fallback=after.page.locator('.jd2-header .jd2-logo__img')
    assert.equal(await fallback.getAttribute('src'),'/images/industry/san_xuat_xay_dung.jpg','missing image selects the actual industry fallback')
    for(const page of [before.page,after.page]) await page.locator('.jd2-header .jd2-logo__img').evaluate(img=>img.decode())
    assert(await fallback.evaluate(img=>img.complete&&img.naturalWidth>0),'industry fallback really loads')
   }
   assert.deepEqual(await frame(after.page),await frame(before.page),`KDA approved image-present frame ${width}/${state}`)
   if(state!=='failed') await checkHeaderPhotoZoom(after.page,width,state)
   await before.context.close();await after.context.close()
  }
  {
   const galleryJob={...kda,image_url:'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/test.png',images:['kda/first.png','kda/second.png']}
   const {page,context}=await open(current,galleryJob,width,'loaded')
   const thumbnails=page.locator('.jd2-gallery__thumb img')
   const sources=await thumbnails.evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src')))
   assert.equal(sources.length,2,'both lower recruitment photos remain')
   await page.locator('.jd2-header button.jd2-logo').click()
   await page.keyboard.press('Escape')
   assert.deepEqual(await thumbnails.evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src'))),sources,'header zoom preserves the lower gallery')
   await page.locator('.jd2-gallery__thumb').first().click()
   const dialog=page.getByRole('dialog')
   await dialog.waitFor({state:'visible'})
   assert.equal(await dialog.locator('img').getAttribute('src'),sources[0],'lower gallery still zooms its own photo')
   await page.keyboard.press('Escape')
   await context.close()
  }
  const {page,context}=await open(current,multi,width)
  const conditions=await page.locator('.jd2-sec--conditions-grid').innerText()
  for(const alternatives of [['2 vị trí, giờ khác','Khác nhau theo 2 vị trí'],['Full time / Part time'],['Theo từng vị trí','nghỉ 4 ngày/tháng']])assert(alternatives.some(text=>conditions.includes(text)),`${width} visible condition summary ${alternatives.join(' / ')}; actual=${conditions}`)
  assert((await page.locator('.jd2-sec--recruit-grid').innerText()).includes('2 vị trí; số người chưa nêu'))
  const meal=page.locator('[data-benefit-scope="role"]')
  assert.equal(await meal.count(),1)
  assert((await meal.innerText()).includes('Ăn ca: chỉ rửa bát, 2 bữa'))
  for(const paragraph of await page.locator('.jd2-detail-section__line').allTextContents())assert(!/FULL TIME —|PART TIME —/.test(paragraph),'no repeated role prefix in visible lines')
  // Lee 2026-11-04 "상세 페이지는 중요한 내용만": 권유 인사말(Gia nhập đội ngũ…, Ứng tuyển sớm…)은 화면에서 거른다.
  const detailText=(await page.locator('.jd2-detail-section__line').allTextContents()).join('\n')
  assert(!detailText.includes('Gia nhập đội ngũ')&&!detailText.includes('Ứng tuyển sớm'),'promo greetings filtered from detail')
  const salary=await page.locator('#jd2-detail-04').innerText()
  assert(salary.includes('Mức lương: 30k-35k/ 1h + thưởng + tip'))
  assert((await page.locator('#jd2-detail-03').innerText()).includes('10h - 10h'),'original ambiguous hours retained')
  await page.screenshot({path:`/tmp/multi-role-browser/roles-${width}.png`,fullPage:true})
  await context.close()
  console.log(`PASS ${width}: KDA frame 3 image states + populated multi-role slots + scoped meals + grouped detail`)
 }
}catch(error){
 // 실패 원인을 검사 화면 표시(annotation)로 남긴다(로그 파일을 못 받는 환경에서도 원인 확인, 2026-10-30).
 console.log(`::error title=multi-role browser::${String(error?.stack||error).replace(/\n/g,' | ').slice(0,1800)}`)
 throw error
}finally{await browser.close()}

// Synthetic public API responses only. Never reads/writes operational data.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync} from 'node:fs'
import {BOMUNTTL_SOURCE,BOMUNTTL_CONTEXT} from '../../src/lib/jobMultiRole.fixtures.ts'
import {buildDescriptionFromSources} from '../../src/lib/jobDescriptionBuild.ts'
const current=process.env.BASE_URL||'http://127.0.0.1:4173'
const baseline=process.env.BASELINE_URL||'http://127.0.0.1:4174'
for(const base of [current,baseline])assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'local-only fixture')
const kda={id:910001,title:'CTY KDA tuyển nam, nữ làm linh kiện tai nghe',company:'CTY KDA',category:'san_xuat_xay_dung',salary:'310k/11h ca ngày, 360k/11h ca đêm',location:'KCN Yên Phong, Bắc Ninh',hours:'11h',work_period:'Toàn thời gian',work_days:'Theo ca',num_hires:'20',employer_phone:'0877880756',active:true,admin_hidden:false,posted_at:'2026-10-13',description:'Công việc\nLàm ngồi linh kiện tai nghe.\nYêu cầu\nTuyển nam, nữ (14-50 tuổi).\nThu nhập\nCa ngày: 310k/11h.\nCa đêm: 360k/11h.\nQuyền lợi\nCó xe đưa đón.'}
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
 await page.goto(`${base}/viec-lam/sb-${job.id}`,{waitUntil:'domcontentloaded'})
 // 첫 화면은 개발 서버가 처음 파일을 묶는 동안(두 서버 동시) 20초를 넘길 수 있다 → 기다리는 시간만 늘림. 비교 내용은 같음.
 await page.locator('h1.jd2-header__title').waitFor({timeout:90000})
 await page.evaluate(()=>document.fonts.ready)
 return {page,context}
}
async function frame(page) {
 return page.evaluate(()=>Object.fromEntries(['.jd2-header','.jd2-sec--conditions-grid','.jd2-sec--recruit-grid','.jd2-detail-sections'].map(selector=> {
  const box=document.querySelector(selector)?.getBoundingClientRect()
  return [selector,box?[box.x,box.width,box.height].map(n=>Math.round(n*10)/10):null]
 })))
}
try {
 for(const width of [390,1366]) {
  for(const state of ['none','loaded','failed']) {
   const job={...kda,image_url:state==='none'?null:'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/test.png'}
   const before=await open(baseline,job,width,state),after=await open(current,job,width,state)
   assert.deepEqual(await frame(after.page),await frame(before.page),`KDA approved frame ${width}/${state}`)
   await before.context.close();await after.context.close()
  }
  const {page,context}=await open(current,multi,width)
  const conditions=await page.locator('.jd2-sec--conditions-grid').innerText()
  for(const alternatives of [['2 vị trí, giờ khác','Khác nhau theo 2 vị trí'],['Full time / Part time'],['Theo từng vị trí','nghỉ 4 ngày/tháng']])assert(alternatives.some(text=>conditions.includes(text)),`${width} visible condition summary ${alternatives.join(' / ')}; actual=${conditions}`)
  assert((await page.locator('.jd2-sec--recruit-grid').innerText()).includes('2 vị trí; số người chưa nêu'))
  const meal=page.locator('[data-benefit-scope="role"]')
  assert.equal(await meal.count(),1)
  assert((await meal.innerText()).includes('Ăn ca: chỉ rửa bát, 2 bữa'))
  for(const paragraph of await page.locator('.jd2-detail-section__line').allTextContents())assert(!/FULL TIME —|PART TIME —/.test(paragraph),'no repeated role prefix in visible lines')
  const other=await page.locator('#jd2-detail-07').innerText()
  assert(other.includes('Gia nhập đội ngũ')&&other.includes('Ứng tuyển sớm'))
  const salary=await page.locator('#jd2-detail-04').innerText()
  assert(salary.includes('Mức lương: 30k-35k/ 1h + thưởng + tip'))
  assert((await page.locator('#jd2-detail-03').innerText()).includes('10h - 10h'),'original ambiguous hours retained')
  await page.screenshot({path:`/tmp/multi-role-browser/roles-${width}.png`,fullPage:true})
  await context.close()
  console.log(`PASS ${width}: KDA frame 3 image states + populated multi-role slots + scoped meals + grouped detail`)
 }
}finally{await browser.close()}

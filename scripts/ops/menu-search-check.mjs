// Read-only live acceptance; isolated browser fixtures only on localhost.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const base=process.env.BASE_URL||'http://localhost:4173'
const local=new URL(base).hostname==='localhost'
const out=process.env.SCREENSHOT_DIR||'menu-search-proof'
mkdirSync(out,{recursive:true})
const fixtures=[
 {id:910001,job_duration:'Một ngày',urgent:false,labor_contract_pledge:true},
 {id:910002,job_duration:'Dưới 1 tuần',urgent:false,social_insurance_pledge:true},
 {id:910003,job_duration:'Trên 1 năm',urgent:true},
 {id:910004,urgent:false},
].map(j=>({title:'TEST ONLY '+j.id,company:'TEST ONLY',category:'san_xuat_xay_dung',salary:'15 triệu/tháng',salary_period:'month',location:'Bắc Ninh',active:true,admin_hidden:false,source:'manual',description:'TEST ONLY',employer_phone:'',posted_at:'2026-10-22',...j}))
let rows=fixtures
if(!local){
 const src=readFileSync('src/lib/supabase.ts','utf8')
 const db=src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0]
 const anon=src.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0]
 const r=await fetch(db+'/rest/v1/local_jobs?select=id,job_duration,urgent,labor_contract_pledge,social_insurance_pledge&active=eq.true&admin_hidden=eq.false',{headers:{apikey:anon}})
 assert.equal(r.status,200);rows=await r.json()
}
const browser=await chromium.launch()
const checks=[]
try{
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390,permissions:[]})
  if(local)await context.route('**/rest/v1/**',route=>route.fulfill({json:new URL(route.request().url()).pathname.endsWith('/local_jobs')?rows:[]}))
  const page=await context.newPage()
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const expectedIds=(predicate)=>rows.filter(predicate).map(j=>'sb-'+j.id).sort()
  const verify=async expected=>{
   await page.waitForFunction(ids=>JSON.stringify([...document.querySelectorAll('.jc[data-job-id]')].map(e=>e.dataset.jobId).sort())===JSON.stringify(ids),expected,{timeout:45000})
   await page.getByText(new RegExp('Tổng '+expected.length+' việc làm')).waitFor()
   assert.equal(await page.getByRole('checkbox',{name:'Chỉ tuyển gấp',exact:true}).isChecked(),false)
  }
  // Empty result sets can be identical for consecutive filters. Wait for the
  // selected condition and URL to settle before comparing result IDs.
  const waitCondition=async (duration='',pledge=false)=>page.waitForFunction(({duration,pledge})=>{
   const url=new URL(location.href)
   const select=document.querySelector('select[aria-label="Thời gian làm việc"]')
   const checkbox=[...document.querySelectorAll('input[type=checkbox]')].find(e=>e.closest('label')?.textContent.includes('Có cam kết hợp đồng / BHXH'))
   return select?.value===duration && checkbox?.checked===pledge && (url.searchParams.get('duration')||'')===duration && (url.searchParams.get('pledge')==='1')===pledge
  },{duration,pledge},{timeout:45000})
  const menu=async name=>{
   await page.getByRole('button',{name:'Mở danh mục Việc làm',exact:true}).hover()
   await page.getByRole('button',{name,exact:true}).click()
  }
  await page.goto(base+'/viec-lam/tim-kiem',{waitUntil:'domcontentloaded'})
  await verify(expectedIds(()=>true))
  if(width===1366)await menu('Một ngày')
  else await page.getByRole('combobox',{name:'Thời gian làm việc',exact:true}).selectOption('Một ngày')
  await waitCondition('Một ngày')
  await verify(expectedIds(j=>j.job_duration==='Một ngày'))
  assert.equal(new URL(page.url()).searchParams.get('duration'),'Một ngày')
  assert.equal(await page.getByRole('combobox',{name:'Thời gian làm việc',exact:true}).inputValue(),'Một ngày')
  await page.screenshot({path:out+`/duration-${width}.png`,fullPage:true})
  if(width===1366){
   // Same mounted search page: header navigation must replace previous conditions.
   await menu('Dưới 1 tuần')
   await waitCondition('Dưới 1 tuần')
   await verify(expectedIds(j=>j.job_duration==='Dưới 1 tuần'))
   assert.equal(await page.getByRole('combobox',{name:'Thời gian làm việc',exact:true}).inputValue(),'Dưới 1 tuần')
   await menu('🤝 Có cam kết hợp đồng / BHXH')
  }else {
   await page.getByRole('combobox',{name:'Thời gian làm việc',exact:true}).selectOption('')
   await page.getByRole('checkbox',{name:'Có cam kết hợp đồng / BHXH',exact:true}).check()
  }
  await waitCondition('',true)
  await verify(expectedIds(j=>j.labor_contract_pledge===true||j.social_insurance_pledge===true))
  assert.equal(new URL(page.url()).searchParams.get('pledge'),'1')
  assert.equal(new URL(page.url()).searchParams.has('duration'),false)
  assert.equal(await page.getByRole('checkbox',{name:'Có cam kết hợp đồng / BHXH',exact:true}).isChecked(),true)
  await page.screenshot({path:out+`/pledge-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'Xóa hết bộ lọc',exact:true}).click()
  await waitCondition()
  await verify(expectedIds(()=>true))
  assert.equal(new URL(page.url()).searchParams.has('pledge'),false)
  if(width===1366){
   await menu('🔥 Tuyển gấp')
   await page.waitForURL('**/viec-lam/tuyen-gap')
   assert.equal(new URL(page.url()).pathname,'/viec-lam/tuyen-gap')
  }
  assert.deepEqual(errors,[])
  checks.push({width,ok:true,publicRows:rows.length,mode:local?'isolated fixtures':'live public jobs'})
  await context.unrouteAll({behavior:'ignoreErrors'});await context.close()
 }
}finally{await browser.close();writeFileSync(out+'/result.json',JSON.stringify({base,checks},null,2))}
console.log(JSON.stringify(checks))

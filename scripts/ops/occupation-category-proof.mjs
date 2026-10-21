// Read-only production acceptance. Uses real public jobs, never inserts test postings.
import {chromium} from 'playwright'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const base=process.env.BASE_URL||'https://www.viecganban.vn'
const src=readFileSync('src/lib/supabase.ts','utf8')
const db=src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0]
const anon=src.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0]
const res=await fetch(db+'/rest/v1/local_jobs?select=id,title,category,occupation_code&active=eq.true&admin_hidden=eq.false',{headers:{apikey:anon}})
assert.equal(res.status,200)
const jobs=await res.json()
for(const j of jobs){
 const mapped=await fetch(db+'/rest/v1/rpc/category_for_occupation',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({p_code:j.occupation_code})})
 assert.equal(mapped.status,200,'live category function exposed for public code lookup')
 assert.equal(await mapped.json(),j.category,'live saved category agrees with official code')
}
const expected=jobs.filter(j=>j.category==='san_xuat_xay_dung').map(j=>'sb-'+j.id)
assert.ok(expected.length,'existing real production jobs available for menu verification')
mkdirSync('app-smoke-screens',{recursive:true})
const browser=await chromium.launch()
const checks=[]
try{
 let target
 for(const width of [1366,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390,permissions:[]})
  const page=await ctx.newPage()
  if(width===1366){
   await page.goto(base+'/viec-lam/tim-kiem',{waitUntil:'domcontentloaded'})
   await page.getByRole('button',{name:'Mở danh mục Việc làm',exact:true}).click()
   const link=page.getByRole('link',{name:'🏭 Nhà máy / Sản xuất / KCN',exact:true})
   target=await link.getAttribute('href')
   assert.equal(new URL(target,base).searchParams.get('cat'),'san_xuat_xay_dung')
   await page.screenshot({path:'app-smoke-screens/category-menu-pc.png'})
   await link.click()
  }else await page.goto(new URL(target,base).href,{waitUntil:'domcontentloaded'})
  for(const id of expected)await page.locator(`[data-job-id="${id}"]`).first().waitFor({state:'attached',timeout:45000})
  assert.equal(new URL(page.url()).searchParams.get('cat'),'san_xuat_xay_dung')
  // Also show the plain industry search page so the captured result cards are readable without the map.
  await page.goto(base+'/viec-lam/tim-kiem?cat=san_xuat_xay_dung',{waitUntil:'domcontentloaded'})
  for(const id of expected)await page.locator(`.jc[data-job-id="${id}"]`).waitFor({state:'visible',timeout:45000})
  const ids=await page.locator('.jc[data-job-id]').evaluateAll(els=>els.map(e=>e.dataset.jobId))
  assert.deepEqual([...new Set(ids)].sort(),[...expected].sort())
  await page.screenshot({path:`app-smoke-screens/category-results-${width}.png`,fullPage:true})
  checks.push({width,ids,url:page.url(),ok:true})
  await ctx.close()
 }
}finally{await browser.close();writeFileSync('occupation-category-proof.json',JSON.stringify({base,checks},null,2))}
console.log(JSON.stringify(checks))

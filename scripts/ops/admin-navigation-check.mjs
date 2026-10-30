// Render the real admin UI with isolated, browser-only API fixtures. No DB writes,
// real credentials, or external map requests. Runs against preview or production.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
for (const ev of ['uncaughtException','unhandledRejection']) process.on(ev,e=>{console.log(`::error title=admin navigation::${String(e?.stack||e).replace(/\n/g,' | ').slice(0,1800)}`);process.exit(1)})

const base=(process.env.BASE_URL||'http://localhost:4173').replace(/\/$/,'')
const user={id:'00000000-0000-4000-8000-000000000001',email:'browser-fixture@example.invalid',
  app_metadata:{role:'admin'},user_metadata:{role:'seeker'},aud:'authenticated',role:'authenticated'}
const exp=Math.floor(Date.now()/1000)+3600
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url')
const session={access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp,role:'authenticated'})+'.fixture',
  refresh_token:'browser-fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
async function settled(page) {await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
async function assertScroll(page,before,label) {
  await settled(page)
  const {y,max}=await page.evaluate(()=>({y:window.scrollY,max:document.documentElement.scrollHeight-innerHeight}))
  assert.ok(Math.abs(y-Math.min(before,max))<=2,`${label}: scroll ${before} -> ${y} (max ${max})`)
}
try {
for(const viewport of [{width:1366,height:900},{width:390,height:844}]) {
  const context=await browser.newContext({viewport})
  let pending=Array.from({length:12},(_,i)=>({jobId:9000+i,title:'Navigation queue '+i,company:'PRIVATE BROWSER FIXTURE',
    address:[1,5].includes(i)?'Fixture shared address':'Fixture address '+i,workLocationId:null,approximate:null,createdAt:'2026-01-01T00:00:00Z'}))
  let candidates=Array.from({length:3},(_,i)=>({id:8000+i,job_id:9900+i,job_title:'Navigation candidate '+i,
    company_snapshot:'PRIVATE BROWSER FIXTURE',current_company:'PRIVATE BROWSER FIXTURE',current_location:'Fixture address',
    address_snapshot:'Fixture address',lat:21.1861,lng:106.0763,place_precision:'building',source:'other',
    evidence:'Browser-only fixture',evidence_urls:['https://www.google.com/maps?q=21.1861,106.0763'],
    status:'pending',address_still_present:true,review_note:null,created_at:'2026-01-01T00:00:00Z'}))
  const jobs=[{id:9900,title:'Private fixture job',company:'PRIVATE BROWSER FIXTURE',origin:'admin',active:false,
    admin_hidden:true,employer_id:null,created_at:'2026-01-01T00:00:00Z'}]
  await context.addInitScript(s=>localStorage.setItem('sb-edhuesdnuxlbcfephutq-auth-token',JSON.stringify(s)),session)
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url())
    const json=data=>route.fulfill({json:data,headers:{'access-control-allow-origin':'*','content-range':'0-0/1'}})
    if(url.origin!==new URL(base).origin && !url.hostname.endsWith('.supabase.co')) {
      if(req.isNavigationRequest()) return route.fulfill({contentType:'text/html',body:'External link fixture'})
      return route.abort()
    }
    if(url.pathname.startsWith('/auth/v1/')) return json(user)
    if(url.pathname.startsWith('/rest/v1/')) {
      if(url.pathname.endsWith('/admin_list_location_candidates')) return json(candidates)
      if(url.pathname.endsWith('/admin_review_location_candidate')) {
        const body=req.postDataJSON()
        candidates=candidates.map(c=>c.id===body.p_candidate_id?{...c,status:'approved'}:c)
        return json({id:body.p_candidate_id,status:'approved'})
      }
      if(url.pathname.endsWith('/local_jobs') && !url.searchParams.has('active')) return json(jobs)
      if(url.pathname.endsWith('/korea_jobs_public')) return json([{id:7,title:'Korea fixture',region:'Seoul'}])
      return json([])
    }
    if(url.pathname.startsWith('/api/')) {
      if(url.searchParams.get('action')==='location-review') {
        if(req.method()==='GET') return json({pending,count:pending.length})
        const body=req.postDataJSON()
        if(body.action==='resolve') return json({point:{lat:21.1861,lng:106.0763,resolvedUrl:body.link}})
        if(body.action==='confirm') {
          const address=pending.find(j=>j.jobId===body.jobId)?.address
          pending=pending.filter(j=>j.address!==address)
          return json({ok:true})
        }
      }
      if(url.searchParams.get('operation')==='line-picks') return json({pending:[{jobId:9900,title:'Private fixture job',line:'Browser fixture line'}]})
      return json([])
    }
    return route.continue()
  })
  const page=await context.newPage()
  page.setDefaultTimeout(12000)
  const locationHeading=()=>page.getByRole('heading',{name:/Vị trí cần xác nhận/})
  const locations=()=>page.getByRole('button',{name:/Vị trí/}).first()
  const jobsTab=()=>page.getByRole('button',{name:/Jobs/}).first()
  await page.goto(base+'/admin?tab=locations&keep=1')
  await page.getByRole('heading',{name:'Dashboard Quản trị',exact:true}).waitFor()
  await locationHeading().waitFor({state:'visible'})
  const historyLength=await page.evaluate(()=>history.length)
  await locations().click()
  assert.equal(await page.evaluate(()=>history.length),historyLength,'active tab added duplicate history')
  await jobsTab().click()
  assert.equal(new URL(page.url()).searchParams.get('tab'),'jobs')
  assert.equal(new URL(page.url()).searchParams.get('keep'),'1')
  await page.goBack()
  await locationHeading().waitFor({state:'visible'})
  await page.goForward()
  await page.getByRole('heading',{name:'Chọn mục cho dòng chưa xác định'}).waitFor()
  await page.reload()
  await page.getByRole('heading',{name:'Chọn mục cho dòng chưa xác định'}).waitFor()
  await locations().click()
  await page.reload()
  await locationHeading().waitFor()
  // 2026-10-30 목록식: 줄을 펼쳐야 문제 부분(지도 링크 포함)이 보인다.
  await page.locator('article.admin-location-card button[aria-expanded="false"]').first().click()
  const google=page.getByRole('link',{name:'Xem địa chỉ gốc trên Google Maps'}).first()
  const original=page.url()
  const popupReady=page.waitForEvent('popup')
  await google.click()
  const popup=await popupReady
  await popup.waitForURL(/google\.com/)
  await popup.close()
  await page.bringToFront()
  assert.equal(page.url(),original,'external link changed the admin URL')
  await locationHeading().waitFor()
  const externalLinks=await page.locator('a[href]').evaluateAll(links=>links.filter(a=>/^https?:/.test(a.href)||/\/viec-(lam|han-quoc)\//.test(a.href)).map(a=>({href:a.href,target:a.target,rel:a.rel})))
  assert.ok(externalLinks.length>0)
  for(const link of externalLinks) {
    assert.equal(link.target,'_blank',link.href)
    assert.match(link.rel,/noopener|noreferrer/,link.href)
  }
  const card=page.locator('article.admin-location-card').filter({hasText:'#9005 —'})
  // 2026-10-30 Lee: 목록식 — 줄을 눌러 펼친 뒤 문제(위치)를 고치고 "수정 완료"로 저장.
  const row=card.getByRole('button',{name:/#9005 —/})
  if (await row.getAttribute('aria-expanded')!=='true') await row.click()
  await card.locator('input[type="url"]').fill('https://www.google.com/maps?q=21.1861,106.0763')
  // 2026-10-30 Lee: Google 지도 탭에 갔다가 돌아와도 펼친 칸·붙여 넣은 링크가 그대로여야 한다(이전엔 화면 전체를 다시 만들어 닫히고 3초 빈 목록).
  for (const state of ['hidden','visible']) {
    await page.evaluate(v=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>v});Object.defineProperty(document,'hidden',{configurable:true,get:()=>v==='hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event(v==='visible'?'focus':'blur'))},state)
    await page.waitForTimeout(1500)
  }
  await page.waitForTimeout(2000)
  assert.equal(await row.getAttribute('aria-expanded'),'true','tab return collapsed the open row')
  assert.equal(await card.locator('input[type="url"]').inputValue(),'https://www.google.com/maps?q=21.1861,106.0763','tab return lost the pasted link')
  await card.getByRole('button',{name:'📍 Lấy vị trí'}).click()
  const confirm=card.getByRole('button',{name:/Hoàn tất sửa/})
  await confirm.scrollIntoViewIfNeeded()
  await settled(page)
  const before=await page.evaluate(()=>scrollY)
  assert.ok(before>200,'fixture did not exercise a scrolled viewport')
  await confirm.click()
  await card.waitFor({state:'detached'})
  await assertScroll(page,before,'queue confirmation')
  assert.equal(new URL(page.url()).searchParams.get('tab'),'locations')
  const candidate=page.locator('article.admin-location-card').filter({hasText:'Navigation candidate 0'})
  const approve=candidate.getByRole('button',{name:'Duyệt vị trí',exact:true})
  await approve.scrollIntoViewIfNeeded()
  await settled(page)
  const candidateBefore=await page.evaluate(()=>scrollY)
  await approve.click()
  await candidate.waitFor({state:'detached'})
  await assertScroll(page,candidateBefore,'candidate approval')
  await jobsTab().click()
  await page.locator('a[href*="/viec-"]').nth(2).waitFor()
  const jobLinks=await page.locator('a[href*="/viec-"]').evaluateAll(links=>links.map(a=>({href:a.href,target:a.target})))
  assert.ok(jobLinks.length>=3,'fixture must exercise VN, Korea and line-pick detail links')
  for(const link of jobLinks) assert.equal(link.target,'_blank',link.href)
  await page.goto(base+'/admin?tab=invalid')
  await page.getByRole('heading',{name:'Người dùng mới nhất'}).waitFor()
  console.log(`PASS ${viewport.width}px: URL tab, reload, back/forward, external popup, detail links, queue and candidate scroll`)
  await context.close()
}
} finally {await browser.close()}

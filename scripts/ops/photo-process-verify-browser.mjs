// Tests the actual acceptance driver with isolated HTTPS routes, never live data.
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { runPhotoVerification } from './photo-process-verify.mjs'
const stored='https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/company/example.png'
const source='https://example.org/branch.png'
const payload={company:'Example Vân Dương',title:'Admissions vacancy',image_url:stored,logo_check:{job_id:900001,result:'stored',official_url:'https://example.org/',source_image_url:source,stored_url:stored,company_evidence:'Branch sign and address checked'}}
const png=readFileSync('public/logo.png')
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']})
try {
 for(const mode of ['actual','fallback','other-job']) {
  const broken=mode==='fallback'
  let writes=0
  const fixtureBrowser={async newContext(options) {
   const c=await browser.newContext(options)
   await c.route('**/*',route=>{
    if(!['GET','HEAD'].includes(route.request().method()))writes++
    const url=route.request().url()
    if(url.endsWith('.png'))return route.fulfill({contentType:'image/png',body:png})
    if(url.startsWith('https://example.org/'))return route.fulfill({contentType:'text/html; charset=utf-8',body:`<h1>${payload.company}</h1><img src="${source}"><script>fetch('/write',{method:'POST'}).catch(()=>{})</script>`})
    return route.fulfill({contentType:'text/html; charset=utf-8',body:`<div class="jd2-header"><img class="jd2-logo__img" alt="${payload.company}" src="${broken?'https://viecganban.vn/images/industry/default.png':stored}"></div><script id="__INITIAL_STATE__" type="application/json">${JSON.stringify({jobs:[{id:mode==='other-job'?'sb-900002':'sb-900001',company:payload.company,title:payload.title}]})}</script>`})
   })
   return c
  }}
  const proof=await runPhotoVerification(payload,{detailUrl:'https://viecganban.vn/viec-lam/sb-900001',browser:fixtureBrowser,proofDir:`/tmp/photo-driver-${mode}`,async fetchImage(){return new Response(png,{headers:{'content-type':'image/png'}})}})
  assert.equal(proof.complete,mode==='actual','actual driver distinguishes stored photo from a loaded fallback: '+JSON.stringify(proof))
  assert.equal(proof.views.length,2,'desktop and mobile both inspected')
  assert.equal(writes,0,'verification blocks mutation requests')
 }
 console.log('photo-process browser: actual source/storage/DOM/decoded image, fallback rejection, read-only and both viewports passed')
}finally{await browser.close()}

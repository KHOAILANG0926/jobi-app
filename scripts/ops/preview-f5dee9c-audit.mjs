// Inspection only: no application code, credentials, DB writes or map mocks.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
const out='mobile-audit'; mkdirSync(out,{recursive:true});
const results=[];
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
for(const [width,height] of [[360,800],[390,844],[412,915],[1366,900]]) {
 for(const permission of ['prompt','granted','denied']) {
  const id=width+'-'+permission;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600,geolocation:{latitude:21.1861,longitude:106.0763},permissions:permission==='granted'?['geolocation']:[]});
  const page=await context.newPage(); page.setDefaultTimeout(8000); const logs=[]; const steps=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push({type:m.type(),message:m.text()})});
  page.on('pageerror',e=>logs.push({type:'pageerror',message:e.message}));
  page.on('requestfailed',r=>logs.push({type:'requestfailed',url:r.url().split('?')[0],message:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)logs.push({type:'http',status:r.status(),url:r.url().split('?')[0]})});
  if(permission==='denied') {
   const cdp=await context.newCDPSession(page);
   await cdp.send('Browser.setPermission',{permission:{name:'geolocation'},setting:'denied',origin:'https://jobi-8ho6701p5-mshw1895-6089s-projects.vercel.app'});
  }
  async function capture(name) {
   await page.screenshot({path:out+'/'+id+'-'+name+'.jpg',type:'jpeg',quality:75,fullPage:true});
   const geometry=await page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
    const label=e=>(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,100);
    const nodes=[...document.querySelectorAll('button,a,input,select,h1,h2,h3,p,label')].filter(visible);
    const overflow=nodes.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(label);
    const clipped=nodes.filter(e=>e.scrollWidth>e.clientWidth+2&&['hidden','clip'].includes(getComputedStyle(e).overflowX)).map(label);
    const buttons=nodes.filter(e=>e.tagName==='BUTTON');const overlaps=[];
    for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j],r=a.getBoundingClientRect(),s=b.getBoundingClientRect();if(!a.contains(b)&&!b.contains(a)&&Math.min(r.right,s.right)-Math.max(r.left,s.left)>3&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>3)overlaps.push([label(a),label(b)])}
    const canvases=[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,visible:visible(c)}));
    const probe=document.createElement('canvas');const gl=probe.getContext('webgl2')||probe.getContext('webgl');let renderer=null;if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info');renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'available'}
    return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,overflowCandidates:overflow,clippingCandidates:clipped,buttonOverlapCandidates:overlaps,canvases,webglAvailable:!!gl,renderer};
   });
   steps.push({name,geometry:{...geometry,requestedWidth:width},text:await page.locator('body').innerText()});
  }
  async function step(name,fn){try{await fn()}catch(e){steps.push({name,error:e.message.split('\n')[0],unverified:true})}}
  try{
   const res=await page.goto('https://jobi-8ho6701p5-mshw1895-6089s-projects.vercel.app/',{waitUntil:'domcontentloaded',timeout:60000});
   steps.push({name:'navigation',status:res?.status()});await page.locator('.hme').waitFor({timeout:30000});await page.waitForTimeout(2500);await capture('first');
   await step('menu',async()=>{const menu=page.locator('button[aria-label^="Mở danh mục"]').first();await menu.click({timeout:5000});await capture('menu');await menu.click();});
   await step('map-list',async()=>{await page.locator('.hme__map').scrollIntoViewIfNeeded();await page.waitForTimeout(6000);await capture('map-list');});
   await step('region',async()=>{await page.locator('.hme-loc__current').click();await capture('region-open');const select=page.locator('#hme-region');const options=await select.locator('option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean));if(!options.length)throw Error('No selectable region');const before=await select.inputValue();const chosen=options.find(o=>o!==before);if(!chosen)throw Error('No alternative region');await select.selectOption(chosen);steps.push({name:'region-change',before,after:chosen});await page.waitForTimeout(1500);await capture('region-selected');});
   if(permission!=='prompt')await step('location-'+permission,async()=>{await page.locator('.hme-loc__use').filter({hasText:'Gần tôi'}).first().click();await page.waitForTimeout(4000);steps.push({name:'permission',state:await page.evaluate(async()=>(await navigator.permissions.query({name:'geolocation'})).state)});await capture('location');});
   else steps.push({name:'native-permission-dialog',unverified:true,reason:'Headless Chromium cannot capture browser permission UI; granted/denied tested separately via browser permission API.'});
  }catch(e){steps.push({name:'fatal',error:e.message});await capture('failure').catch(()=>{});}
  writeFileSync(out+'/'+id+'.json',JSON.stringify({id,width,height,permission,testCoordinates:{latitude:21.1861,longitude:106.0763},steps,logs},null,2));
  const errors=logs.filter(l=>l.type==='error'||l.type==='pageerror'||l.type==='http');
  results.push({id,steps:steps.map(s=>({name:s.name,error:s.error,unverified:s.unverified})),errors,geometry:steps.filter(s=>s.geometry).map(s=>({name:s.name,...s.geometry}))});
  console.log(JSON.stringify(results.at(-1)));await context.close();
 }
}
await browser.close();
writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
const failures=results.some(r=>r.errors.length||r.steps.some(s=>s.error)||r.geometry.some(g=>g.pageWidth>Number(r.id.split('-')[0])+1));
const summary='Production mobile audit: '+(failures?'ISSUES / inspect artifacts':'Captured; visual review still required')+'\n'+JSON.stringify(results.map(r=>({id:r.id,errors:r.errors.length,unverified:r.steps.filter(s=>s.unverified||s.error)})),null,2);
writeFileSync(out+'/summary.txt',summary);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
process.exitCode=failures?1:0;

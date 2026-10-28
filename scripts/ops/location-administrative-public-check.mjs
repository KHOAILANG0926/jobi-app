// Read-only public REST + real public browser check. No SQL or privileged key.
import {chromium} from 'playwright'
import {supabaseServer as publicClient} from '../../src/lib/supabaseServer.ts'
import {administrativeAreaForTarget,areaContains} from '../../src/lib/administrativeArea.ts'
import {administrativePinIssues} from './location-administrative-oracle.mjs'
const base=process.env.BASE_URL||'https://www.viecganban.vn'
const jobs=[]
let browser
try {
 for(let from=0;;from+=500) {
  const {data,error}=await publicClient.from('local_jobs').select('id,location').eq('active',true).eq('admin_hidden',false).order('id').range(from,from+499).abortSignal(AbortSignal.timeout(15000))
  if(error)throw new Error('public_jobs_unavailable')
  jobs.push(...data)
  if(data.length<500)break
 }
 const locations=[]
 for(let from=0;from<jobs.length;from+=100) {
  const {data,error}=await publicClient.from('job_work_locations').select('id,job_id,raw_address,lat,lng,point_kind,point_precision,point_revision,location_verified').in('job_id',jobs.slice(from,from+100).map(j=>j.id)).abortSignal(AbortSignal.timeout(15000))
  if(error)throw new Error('public_source_points_unavailable')
  locations.push(...data)
 }
 const sourceIssues=[]
 for(const job of jobs) {
  const source=locations.filter(w=>String(w.job_id)===String(job.id)&&w.point_kind!=='unresolved')
  if(!source.length)sourceIssues.push({jobId:job.id,reason:'missing_canonical_pin',originalLocation:job.location})
  for(const point of source) {
   const area=administrativeAreaForTarget(point.raw_address,job.location)
   if(!area)sourceIssues.push({jobId:job.id,reason:'original_boundary_unavailable',originalLocation:job.location})
   else if(!areaContains(area,point))sourceIssues.push({jobId:job.id,reason:area.proofType==='trusted_city_representative'?'city_witness_does_not_establish_this_point':'outside_original_province',originalLocation:job.location})
  }
 }
 console.log(JSON.stringify({kind:'read-only-live-public-source-only',jobs:jobs.length,rows:locations.length,unverifiedRows:locations.filter(w=>!w.location_verified).length,issues:sourceIssues,renderedMapsVerified:false}))
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 await page.goto(base,{waitUntil:'domcontentloaded'})
 await page.locator('.hme__map').scrollIntoViewIfNeeded()
 await page.waitForFunction(n=>{const c=document.querySelector('[data-testid="home-map-job-counts"]');return c&&c.getAttribute('data-loading')!=='true'&&Number(c.getAttribute('data-loaded'))===n},jobs.length,{timeout:30000})
 const main=await page.locator('.hme-map [data-location-points]').evaluateAll(elements=>elements.flatMap(el=>JSON.parse(el.dataset.locationPoints)))
 const mainPoints=Object.fromEntries(jobs.map(job=>[String(job.id),main.filter(p=>String(p.jobId).replace(/^sb-/,'')===String(job.id))]))
 const detailPoints={}
 for(const job of jobs) {
  await page.goto(`${base}/viec-lam/sb-${job.id}`,{waitUntil:'domcontentloaded'})
  await page.locator('.jd2-page h1').waitFor()
  await page.waitForFunction(()=>document.querySelector('.jd2-vmap [data-location-points]')!==null,null,{timeout:15000}).catch(()=>{})
  detailPoints[String(job.id)]=await page.locator('.jd2-vmap [data-location-points]').evaluateAll(elements=>elements.flatMap(el=>JSON.parse(el.dataset.locationPoints)))
 }
 const issues=administrativePinIssues(jobs,locations,mainPoints,detailPoints)
 console.log(JSON.stringify({kind:'read-only-live-public',base,jobs:jobs.length,unverifiedSourceRows:locations.filter(w=>!w.location_verified).length,issues}))
 if(issues.length)process.exitCode=1
} catch(error) {
 console.log(JSON.stringify({kind:'read-only-live-public',base,verified:false,error:error.message}))
 process.exitCode=1
} finally {await browser?.close()}

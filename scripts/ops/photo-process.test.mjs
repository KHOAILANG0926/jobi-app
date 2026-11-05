import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { photoProcessPlan, verifyPhotoProcess } from './photo-process.mjs'
const stored='https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/company/example.jpg'
const payload={company:'Example Vân Dương',title:'Admissions vacancy',source_url:'https://example.org/job',image_url:stored,logo_check:{job_id:900001,result:'stored',official_url:'https://example.org/',source_image_url:'https://example.org/branch.jpg',company_evidence:'Vân Dương sign and matching street address',stored_url:stored}}
const pending={...payload,logo_check:{result:'found_unstored',official_url:'https://example.org/',note:'브랜드 아님'}}
assert.equal(photoProcessPlan(pending).stage,'store_pending','found but not saved is never completion')
assert.equal(photoProcessPlan({...payload,logo_check:{...payload.logo_check,company_evidence:''}}).stage,'identify_pending','company/site identification required')
assert.equal(photoProcessPlan({...payload,image_url:undefined}).stage,'link_pending','saved but not linked is not complete')
assert.equal(photoProcessPlan(payload).complete,false,'a filled record alone is never verified completion')
const responses=[]
const run=(extra={},image=async()=>({contentType:'image/jpeg',bytes:new Uint8Array([255,216,255,1])}))=>verifyPhotoProcess(payload,{detailUrl:'https://viecganban.vn/viec-lam/sb-900001',async inspect(width){responses.push(width);return {company:payload.company,detailUrl:'https://viecganban.vn/viec-lam/sb-900001',jobId:'sb-900001',title:payload.title,src:stored,loaded:true,sourceVerified:true,...extra}},image})
assert.equal((await run()).complete,true,'only executed checks complete the process')
assert.deepEqual(responses,[1366,390],'both desktop and mobile are checked')
assert.equal((await run({src:'/images/industry/cskh_kinh_doanh.jpg'})).complete,false,'fallback cannot masquerade as real company image')
assert.equal((await run({loaded:false})).complete,false,'load failure blocks completion')
assert.equal((await run({company:'Another company'})).complete,false,'wrong employer blocks completion')
assert.equal((await run({sourceVerified:false})).complete,false,'unverified source blocks completion')
assert.equal((await run({jobId:'sb-900002'})).complete,false,'another job from the same company must not pass')
assert.equal((await run({title:'Another vacancy'})).complete,false,'different vacancy content must not pass')
assert.equal((await run({detailUrl:'https://viecganban.vn/viec-lam/sb-900002'})).complete,false,'redirect to another job cannot pass')
assert.equal(photoProcessPlan({...payload,job_id:900002}).stage,'link_pending','update target cannot differ from verification target')
assert.equal((await run({},async url=>({contentType:'image/jpeg',bytes:new Uint8Array([255,216,255,url===stored?2:1])}))).complete,false,'different original/stored bytes block completion')
assert.equal((await run({},async()=>{throw new Error('HTTP 403')})).complete,false,'unavailable source never counts as completed')
assert.equal(photoProcessPlan({...payload,logo_check:{...payload.logo_check,complete:true}}).complete,false,'a manual completion flag is ignored')
const registration=spawnSync(process.execPath,['scripts/ops/ingest-sql.mjs','scripts/ops/jobs/fb-regal-edu-van-duong-20261104.json'],{encoding:'utf8'})
assert.equal(registration.status,0,'pending photo must not block registration SQL generation: '+registration.stderr)
assert.match(registration.stdout,/select public\.ingest_job/,'original single-entry registration is preserved')
assert.ok(registration.stdout.includes('사진 처리 미완료: store_pending'),'actual registration output must disclose pending photo')
console.log('photo-process: pending, identity, linkage, real loading and desktop/mobile completion passed')

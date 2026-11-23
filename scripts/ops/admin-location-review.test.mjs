import test from 'node:test'
import assert from 'node:assert/strict'
import { coordinatesFromGoogleUrl, resolveGoogleShareLink } from '../../api/_lib/admin-location-review.js'

test('accept explicit Google Maps Vietnam destination coordinates',()=>{
  assert.deepEqual(coordinatesFromGoogleUrl('https://www.google.com/maps?q=21.186100,106.076300'),{lat:21.1861,lng:106.0763})
  assert.deepEqual(coordinatesFromGoogleUrl('https://www.google.com/maps/place/test/data=!3d21.1861!4d106.0763'),{lat:21.1861,lng:106.0763})
})
test('refuse viewport, foreign, SSRF, malformed coordinates',()=>{
  for(const link of [
    'https://www.google.com/maps/@21.1861,106.0763,16z',
    'https://maps.app.goo.gl/short',
    'https://maps.app.goo.gl.evil.example/a?q=21.1,106.1',
    'https://127.0.0.1/maps?q=21.1,106.1',
    'http://maps.app.goo.gl/a',
    'https://www.google.com/maps?q=10,20',
    'https://www.google.com/maps?q=46.0000,106.0763',
  ])assert.equal(coordinatesFromGoogleUrl(link),null,link)
})
test('unshorten maps.app.goo.gl through a whitelisted redirect only',async()=>{
  const result=await resolveGoogleShareLink('https://maps.app.goo.gl/Example',async()=>{
    return {status:302,headers:{get:(key)=>key==='location'?'https://www.google.com/maps?q=21.186100,106.076300':null}}
  })
  assert.equal(result.lat,21.1861);assert.equal(result.lng,106.0763)
})
test('reject redirect to arbitrary hosts',async()=>{
  await assert.rejects(()=>resolveGoogleShareLink('https://maps.app.goo.gl/Example',async()=>({
    status:302,headers:{get:()=> 'https://private.example/path'}
  })),/Google Maps links only/)
})

// 2번 지도 정상화(2026-11-23): 확정(confirm)은 주소(매장)마다 — 다른 매장이 이미 확정돼 있어도 이 주소는 확정할 수 있다.
import { createAdminLocationReviewHandler } from '../../api/_lib/admin-location-review.js'
const table=(rows)=>{const b={select:()=>b,eq:()=>b,order:()=>b,limit:()=>b,maybeSingle:async()=>({data:Array.isArray(rows)?rows[0]??null:rows,error:null}),then:(ok,no)=>Promise.resolve({data:rows,error:null}).then(ok,no)};return b}
function confirmHandler(approved){
  const rpcCalls=[]
  const service={auth:{getUser:async()=>({data:{user:{app_metadata:{role:'admin'}}},error:null})},
    from:(name)=>table(name==='local_jobs'?{id:7,location:'Lô A1 KCN Quế Võ, Bắc Ninh',company:'CTY KDA'}
      :name==='job_work_locations'?[{id:1,raw_address:'Lô A1 KCN Quế Võ, Bắc Ninh'},{id:2,raw_address:'Lô D4 KCN Quế Võ, Bắc Ninh'}]
      :approved)}
  const caller=()=>({rpc:async(name,args)=>{rpcCalls.push([name,args.p_address??null]);return {data:{id:99},error:null}}})
  return {rpcCalls,handler:createAdminLocationReviewHandler({service,caller})}
}
async function confirm(approved,address){
  const {handler,rpcCalls}=confirmHandler(approved)
  const res={code:0,body:null,setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this}}
  await handler({method:'POST',headers:{authorization:'Bearer t'},body:{action:'confirm',jobId:7,address,lat:21.2,lng:106.2,workLocationId:null}},res)
  return {res,rpcCalls}
}
test('confirm: another store already confirmed → this address can still be confirmed',async()=>{
  const {res,rpcCalls}=await confirm([{id:5,address_snapshot:'Lô A1 KCN Quế Võ, Bắc Ninh'}],'Lô D4 KCN Quế Võ, Bắc Ninh')
  assert.equal(res.code,200,JSON.stringify(res.body))
  assert.deepEqual(rpcCalls.map(c=>c[0]),['admin_add_location_candidate','admin_review_location_candidate'])
})
test('confirm: same address already confirmed (any spelling of the same key) → refused',async()=>{
  const {res,rpcCalls}=await confirm([{id:5,address_snapshot:'lo a1, KCN Que Vo - Bac Ninh'}],'Lô A1 KCN Quế Võ, Bắc Ninh')
  assert.equal(res.code,409)
  assert.equal(rpcCalls.length,0)
})

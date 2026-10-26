import assert from 'node:assert/strict'
import { createMapLocationsHandler } from './map-locations.js'
import { createAutoLocationHandler } from './_lib/admin-auto-location.js'
const response = () => ({code:0,body:null as unknown,setHeader(){},status(c:number){this.code=c;return this},json(b:unknown){this.body=b;return this}})
let reads=0, runs=0
const publicHandler = createMapLocationsHandler({async read(ids:number[]){reads++;return ids.map(id=>({job_id:id,source_points:[{workLocationId:id * 10,kind:'gate',lat:21,lng:106,precision:'entrance',revision:2,source:'OSM node/test',checkedAt:'2026-10-15',evidence:'PRIVATE'},{workLocationId:id * 10 + 1,kind:'area',lat:21.1,lng:106.1,precision:'ward',revision:1,source:'source row',checkedAt:'2026-10-15'}]}))}})
const bad=response(); await publicHandler({method:'GET',query:{ids:'1;DROP'}},bad); assert.equal(bad.code,400);assert.equal(reads,0)
const good=response(); await publicHandler({method:'GET',query:{ids:'1,1'}},good);assert.equal(good.code,200)
assert.equal((good.body as any).points['sb-1'].length,2,'public response retains the complete canonical source set')
assert.equal((good.body as any).points['sb-1'][0].evidence,undefined)
assert.equal((good.body as any).points['sb-1'][0].revision,2)
const admin = createAutoLocationHandler({enabled:()=>true,async verify(token:string){return token==='admin'?{app_metadata:{role:'admin'}}:{user_metadata:{role:'admin'}}},async run(){runs++;return {processed:0}}})
const denied=response();await admin({method:'POST',headers:{authorization:'Bearer user'},body:{}},denied);assert.equal(denied.code,403);assert.equal(runs,0)
const ok=response();await admin({method:'POST',headers:{authorization:'Bearer admin'},body:{}},ok);assert.equal(ok.code,200);assert.equal(runs,1)
const disabled=response();await createAutoLocationHandler({enabled:()=>false})({method:'POST'},disabled);assert.equal(disabled.code,503)
console.log('map-r1 API authorization, projection, limits assertions passed')
// Preview must read only the existing public feed without any service-role key.
const oldEnv=process.env.VERCEL_ENV, oldFetch=globalThis.fetch
process.env.VERCEL_ENV='preview'
let upstream=''
globalThis.fetch=(async (url:unknown)=>{upstream=String(url);return new Response(JSON.stringify({points:{'sb-27':[{workLocationId:270,kind:'area',lat:21.19,lng:105.99,precision:'ward',revision:1,source:'public',checkedAt:'2026-10-21'}]}}),{status:200})}) as typeof fetch
try {
 const preview=response();await createMapLocationsHandler()({method:'GET',query:{ids:'27'}},preview)
 assert.equal(preview.code,200,'preview public feed must work without a DB key')
 assert.equal(upstream,'https://www.viecganban.vn/api/map-locations?ids=27')
 assert.equal((preview.body as any).points['sb-27'][0].kind,'area')
} finally {globalThis.fetch=oldFetch;if(oldEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnv}

const legacy=response();await createMapLocationsHandler({async read(){return [{job_id:1,result:{kind:'area',lat:21,lng:106,source:'provider',checkedAt:'old'}}]}})({method:'GET',query:{ids:'1'}},legacy)
assert.deepEqual((legacy.body as any).points['sb-1'],[],'provider result cannot override canonical source set')

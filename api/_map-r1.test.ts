import assert from 'node:assert/strict'
import { createMapLocationsHandler } from './map-locations.js'
import { createAutoLocationHandler } from './admin-auto-location.js'
const response = () => ({code:0,body:null as unknown,setHeader(){},status(c:number){this.code=c;return this},json(b:unknown){this.body=b;return this}})
let reads=0, runs=0
const publicHandler = createMapLocationsHandler({async read(ids:number[]){reads++;return ids.map(id=>({job_id:id,result:{kind:'gate',lat:21,lng:106,source:'OSM node/test',checkedAt:'2026-10-15',evidence:'PRIVATE'}}))}})
const bad=response(); await publicHandler({method:'GET',query:{ids:'1;DROP'}},bad); assert.equal(bad.code,400);assert.equal(reads,0)
const good=response(); await publicHandler({method:'GET',query:{ids:'1,1'}},good);assert.equal(good.code,200)
assert.equal((good.body as any).points['sb-1'].evidence,undefined)
const admin = createAutoLocationHandler({enabled:()=>true,async verify(token:string){return token==='admin'?{app_metadata:{role:'admin'}}:{user_metadata:{role:'admin'}}},async run(){runs++;return {processed:0}}})
const denied=response();await admin({method:'POST',headers:{authorization:'Bearer user'},body:{}},denied);assert.equal(denied.code,403);assert.equal(runs,0)
const ok=response();await admin({method:'POST',headers:{authorization:'Bearer admin'},body:{}},ok);assert.equal(ok.code,200);assert.equal(runs,1)
const disabled=response();await createAutoLocationHandler({enabled:()=>false})({method:'POST'},disabled);assert.equal(disabled.code,503)
console.log('map-r1 API authorization, projection, limits assertions passed')

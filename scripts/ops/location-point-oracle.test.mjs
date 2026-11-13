import test from 'node:test'
import assert from 'node:assert/strict'
import {sourcePoints,assertPoints,pointsForJob,readPublicSnapshot,settleChange} from './location-point-oracle.mjs'
const point=(id,kind='exact')=>({workLocationId:id,lat:21+id/100,lng:106,kind,precision:kind==='exact'?'building':'commune',revision:2})
test('empty public database is valid and still reads source and cache',async()=>{
 const queries=[]
 const snapshot=await readPublicSnapshot({query:async(sql)=>{queries.push(sql);return {rows:[]}}},2)
 assert.deepEqual(snapshot,[]);assert.equal(queries.length,3)
 assertPoints([],[],'empty');assert.throws(()=>assertPoints([],[point(1)],'extra pin'))
})
test('single point validates kind precision revision and missing/extra points',()=>{
 const p=point(1);assertPoints([p],[{...p}],'one')
 for(const replacement of [{...p,kind:'area'},{...p,precision:'commune'},{...p,revision:1}]) assert.throws(()=>assertPoints([p],[replacement],'stale or downgraded'))
 assert.throws(()=>assertPoints([p],[],'missing'))
})
test('multiple work sites and grouped markers retain every job point',()=>{
 const a=point(1),b=point(2,'area'),c=point(3)
 const markers=[[{...a,jobId:7},{...c,jobId:8}],[{...b,jobId:7}]]
 assertPoints([b,a],pointsForJob(markers,7),'group and individual pins')
 assert.throws(()=>assertPoints([a,b],pointsForJob(markers.slice(0,1),7),'second site lost'))
 assert.deepEqual(sourcePoints([{id:1,lat:null,lng:null,point_kind:'unresolved'}]),[])
})
test('keyset pagination continues across full pages with no fixed job count',async()=>{
 const pages=[[{id:2},{id:9}],[{id:12}],[],[]];const parameters=[]
 const result=await readPublicSnapshot({query:async(sql,args)=>{parameters.push(args);return {rows:pages.shift()}}},2)
 assert.deepEqual(result.map(j=>j.id),[2,9,12]);assert.equal(parameters[1][0],9)
})
test('감사 도중 비공개로 바뀐 공고는 changed, 그대로인데 어긋나면 원래 오류',async()=>{
 const job={id:5342,points:[point(1)]};const boom=new Error('public cache full point set missing')
 assert.equal(await settleChange(boom,job,async()=>({public:false,points:[]})),'changed')
 assert.equal(await settleChange(boom,job,async()=>({public:true,points:[point(1,'area')]})),'changed','원본 위치가 바뀜')
 await assert.rejects(()=>settleChange(boom,job,async()=>({public:true,points:[point(1)]})),boom)
})
test('원본 점이 검증을 통과 못 하면 changed로 넘기지 않고 원래 오류',async()=>{
 const bad={...point(1),revision:0};const job={id:1,points:[bad]};const boom=new Error('invalid source point')
 await assert.rejects(()=>settleChange(boom,job,async()=>({public:true,points:[{...bad}]})),boom)
})

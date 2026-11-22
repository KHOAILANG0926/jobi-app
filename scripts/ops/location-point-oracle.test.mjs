import test from 'node:test'
import assert from 'node:assert/strict'
import {sourcePoints,assertPoints,pointsForJob,readPublicSnapshot,settleChange,classifyMapFailure} from './location-point-oracle.mjs'
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
test('지도 화면 대기 실패: 외부 지도 요청 실패만 외부, 데이터·열쇠·원인 불명은 그대로 실패',()=>{
 const timeout=Object.assign(new Error('waiting for locator'),{name:'TimeoutError'})
 const points=[point(1),point(2,'area')]
 const planned=JSON.stringify(points.map(p=>({...p,jobId:'sb-1'})))
 const vm='https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=***'
 const aborted=[{url:vm,failure:'net::ERR_ABORTED',status:null},{url:vm,failure:'net::ERR_ABORTED',status:null}]
 // 외부: 스타일 요청이 끊겼고, 화면이 그리려던 점은 원본과 같다
 const ok=classifyMapFailure(timeout,{state:{mapError:true,planned},styleRequests:aborted,points})
 assert.equal(ok.external,true);assert.match(ok.reason,/ERR_ABORTED/)
 assert.equal(classifyMapFailure(timeout,{state:{mapError:true},styleRequests:[{url:vm,status:503}],points}).external,true,'5xx도 외부')
 assert.equal(classifyMapFailure(timeout,{state:{mapError:true},styleRequests:[{url:vm,status:429}],points}).external,true,'429도 외부')
 // 데이터 오류: 비교 오류·원본과 다른 점은 외부 요청이 실패했어도 실패
 let assertion;try{assertPoints(points,[],'x')}catch(e){assertion=e}
 assert.equal(classifyMapFailure(assertion,{state:{mapError:true,planned},styleRequests:aborted,points}).external,false,'비교 오류는 외부로 못 묻음')
 const moved=JSON.stringify(points.map(p=>({...p,lat:p.lat+0.5,jobId:'sb-1'})))
 assert.equal(classifyMapFailure(timeout,{state:{mapError:true,planned:moved},styleRequests:aborted,points}).external,false,'그리려던 점이 원본과 다르면 데이터 오류')
 // 원인을 못 묻는 경우: 요청 기록 없음·스타일 정상 응답·우리 열쇠 401/403·다른 종류 오류
 assert.equal(classifyMapFailure(timeout,{state:{planned},styleRequests:[],points}).external,false,'요청 기록이 없으면 외부로 보지 않음')
 assert.equal(classifyMapFailure(timeout,{state:{planned},styleRequests:[{url:vm,status:200}],points}).external,false,'스타일이 정상이면 화면 문제')
 assert.equal(classifyMapFailure(timeout,{state:{planned},styleRequests:[{url:vm,status:403}],points}).external,false,'열쇠 문제')
 assert.equal(classifyMapFailure(timeout,{state:{planned},styleRequests:[{url:'https://viecganban.vn/vietmap/styles/tm.json',status:404}],points}).external,false,'우리 쪽 사본 실패는 외부가 아님')
 assert.equal(classifyMapFailure(timeout,{state:{planned},styleRequests:[{failure:'x'}],points}).external,false,'주소를 모르는 요청은 외부로 묻지 않음')
 assert.equal(classifyMapFailure(timeout,{state:{planned},styleRequests:[...aborted,{url:'https://viecganban.vn/vietmap/styles/tm.json',status:404}],points}).external,false,'VietMap 실패와 사본 실패가 섞이면 외부가 아님')
 assert.equal(classifyMapFailure(new Error('boom'),{state:{planned},styleRequests:aborted,points}).external,false,'시간 초과가 아닌 오류')
})

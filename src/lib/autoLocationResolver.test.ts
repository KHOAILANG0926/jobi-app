import * as resolver from './autoLocationResolver.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }
assert(typeof resolver.resolveAutoLocation === 'function', 'shared automatic resolver exists')
let requests = 0
let reserved = 0
const deps = {
  async cached() { return null },
  async cache() {},
  async reserve() { return ++reserved <= 2 },
  async request() { requests++; return [] },
}
const empty = await resolver.resolveAutoLocation({ id: 1, company: 'Fixture', location: 'unknown', targets: [] }, deps)
assert(empty.kind === 'unresolved' && requests === 0, 'no evidence means no invented point and no lookup')
const address = '12 Nguyễn Trãi, Phường Thanh Xuân Trung, Quận Thanh Xuân, Hà Nội'
const miss = await resolver.resolveAutoLocation({ id: 2, company: 'Fixture', location: address, targets: [{address, workLocationId: null}] }, deps)
assert(miss.kind === 'unresolved' && requests <= 2, 'failed exact lookup respects total two requests')
let attempts = 0
const failure = await resolver.resolveAutoLocation({ id: 3, company: 'Fixture', location: address, targets: [{address, workLocationId: null}] }, {
  ...deps, async reserve() { return true }, async request() { attempts++; throw new Error('private upstream message') },
})
assert(failure.kind === 'unresolved' && failure.failed && attempts === 1, 'no blind retries or private error logs')
requests = 0
const replay = await resolver.resolveAutoLocation({ id: 2, company: 'Fixture', location: address, targets: [{address, workLocationId:null}] }, { ...deps, async cached() { return [] } })
assert(replay.kind === 'unresolved' && requests === 0, 'cached miss prevents repeated calls')
const capped = await resolver.resolveAutoLocation({ id: 4, company: 'Fixture', location: address, targets: [{address,workLocationId:null}] }, { ...deps, async reserve() { return false } })
assert(capped.kind === 'unresolved' && requests === 0, 'storage budget refusal prevents upstream calls')
console.log('autoLocationResolver: no evidence, cache, failures and budget assertions passed')
const job = {id:10,company:'Fixture',location:address,targets:[{address,workLocationId:100}]}
let sequence: string[] = []
const run = (search:unknown,place:unknown) => resolver.resolveAutoLocation(job, {
 ...deps, async reserve(){return true}, async request(action){sequence.push(action);return action==='search'?search:place},
})
const hit={ref_id:'fixture-place',name:'12 Nguyễn Trãi',address}
const place={name:'12 Nguyễn Trãi',display:address,lat:21.0,lng:105.8,ward:'Thanh Xuân Trung',district:'Thanh Xuân',city:'Hà Nội'}
const exact=await run([hit],place)
assert(exact.kind==='exact' && exact.address===address && sequence.join(',')==='search,place','matching street and resolved place approved in two calls')
sequence=[]
const ambiguous=await run([hit,{...hit,ref_id:'other'}],place)
assert(ambiguous.kind==='unresolved' && sequence.length<=2,'ambiguous hit never approved')
sequence=[]
const wrong=await run([hit],{...place,display:'99 Other Road, Hồ Chí Minh',name:'99 Other Road',city:'Hồ Chí Minh'})
assert(wrong.kind==='unresolved','Place response cannot override correct search hit with wrong location')
let total=0
await resolver.resolveAutoLocation({...job,targets:[...job.targets,{address:'20 Nguyễn Trãi, Phường Thanh Xuân Trung, Quận Thanh Xuân, Hà Nội',workLocationId:101}]},{...deps,async reserve(){return true},async request(){total++;return []}})
assert(total<=2,'multiple workplaces share the two-call cap')
console.log('autoLocationResolver: exact match, ambiguity, wrong Place, multi-workplace passed')
const deferred=await resolver.resolveAutoLocation(job,{...deps,async reserve(){return false}})
assert(deferred.deferred===true,'daily budget refusal must defer instead of permanently marking unresolved')

{
  // 2026-10-18 #4828: 새 2단계 주소 + 저장된 동 좌표 → VietMap 호출 0번으로 동 중심
  let calls = 0
  const addr = 'Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh'
  const r = await resolver.resolveAutoLocation({ id: 4828, company: '', location: addr, targets: [{ address: addr, workLocationId: 1 }] }, {
    ...deps, async reserve() { return true }, async request() { calls++; return [] },
    async wardCenter(unit) { return unit.key === 'phuong:phuong lieu||bac ninh' ? { lat: 21.1568, lng: 106.1275, at: '2026-10-08T06:40:06Z' } : null },
  })
  assert(r.kind === 'area' && calls === 0 && (r as { lat: number }).lat === 21.1568, '2-level address uses stored ward center without VietMap calls')
  console.log('autoLocationResolver: 2-level ward cache assertions passed')
}


{
  // Regression: a newly encountered, non-catalogued industrial park must go
  // through the bounded VietMap search path, never fake a known park gate.
  const text = 'KCN Minh Chau, Bắc Ninh'
  let network = 0
  let cached = 0
  const input = {id:900001,company:'',location:text,targets:[{address:text,workLocationId:null}]}
  const unknown = await resolver.resolveAutoLocation(input,{
    ...deps,
    async reserve(){ return true },
    async cached(){ return null },
    async cache(){ cached++ },
    async request(){ network++; return [] },
  })
  assert(unknown.kind === 'unresolved', 'unknown park with no source never generates a fabricated marker')
  assert(network === 1 && cached === 1, 'unknown park triggers bounded search and caches empty result')
  let repeatNetwork = 0
  const repeat = await resolver.resolveAutoLocation(input,{
    ...deps,
    async reserve(){ return true },
    async cached(){ return [] },
    async request(){ repeatNetwork++; return [] },
  })
  assert(repeat.kind === 'unresolved' && repeatNetwork === 0, 'unknown park empty lookup result reused without API')
  const budget = await resolver.resolveAutoLocation(input,{
    ...deps, remainingCalls:0,async reserve(){throw Error('should not reserve')},async request(){throw Error('should not query')},
  })
  assert(budget.kind === 'unresolved', 'no quota does not invent a pin')
}
{
  // A park polygon center must remain an approximate marker, NOT gate directions.
  const addr = 'Nhà máy ADTEK, KCN Quế Võ III, Bắc Ninh'
  let n=0
  const r = await resolver.resolveAutoLocation({id:4879,company:'ADTEK',location:addr,targets:[{address:addr,workLocationId:null}]},{
    ...deps,async reserve(){return true},async request(){n++;return []},
  })
  assert(r.kind === 'area', 'known park without confirmed gate yields approximate area, not an unresolved job')
  assert(n<=2, 'known park respects global two-call budget')
  assert(!('destination' in r), 'approximate park center cannot be used as gate destination')
}
console.log('autoLocationResolver: unknown-park discovery, cached miss, fallback and no-fake-gate assertions passed')

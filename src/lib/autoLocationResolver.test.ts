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
 const approximate=await resolver.resolveAutoLocation({id:123,company:'Any employer',location:'Bắc Ninh',targets:[]},{
  ...deps,async administrativeCenter(){return {lat:21.1861,lng:106.0763,source:'Natural Earth original province bac ninh',checkedAt:'2026-10-28T00:00:00Z'}}
 })
 assert(approximate.kind==='area','null-coordinate jobs retain an administrative approximate pin after higher priority misses')
}
{
 const outside=await resolver.resolveAutoLocation({id:124,company:'Any employer',location:'KCN Quế Võ, Bắc Ninh',targets:[]},{
  ...deps,async withinAdministrativeArea(){return false},async administrativeCenter(){return null}
 })
 assert(outside.kind==='unresolved','known park coordinates outside original administrative boundary cannot become an automatic pin')
}
{
 const first={address:'12 Nguyễn Trãi, Phường Thanh Xuân Trung, Quận Thanh Xuân, Hà Nội',workLocationId:100}
 const second={address:'10 Nguyễn Huệ, Hồ Chí Minh',workLocationId:200}
 const result=await resolver.resolveAutoLocation({...job,targets:[first,second]}, {
  ...deps,async reserve(){return true},async request(action){return action==='search'?[hit]:place},
  async withinAdministrativeArea(addresses){return addresses.includes(first.address)&&!addresses.includes(second.address)},
  async administrativeCenter(){return null},
 })
 assert(result.kind==='exact'&&result.workLocationId===100,'concrete exact workplace survives unrelated province target')
 const area=await resolver.resolveAutoLocation({id:125,company:'Any employer',location:'Bắc Ninh',targets:[{address:'Khu A, Bắc Ninh',workLocationId:301},{address:'Khu B, Bắc Ninh',workLocationId:302}]},{
  ...deps,async administrativeCenter(){return {lat:21.098,lng:106.117,source:'Original province reference',checkedAt:'2026-10-28T05:00:00Z'}}
 })
 assert(area.kind==='area'&&area.address==='Khu A, Bắc Ninh'&&area.workLocationId===301,'multi-workplace area fallback binds explicit canonical target')
}

// ── Goong 두 번째 자료(Lee 2026-10-29): 같은 판정 규칙, 조건 못 채우면 핀 없음 ──
{
  const { findIndustrialPark } = await import('./industrialPark.ts')
  const { insideParkOutline } = await import('./goongLocate.ts')
  const vietmapMiss = { ...deps, async reserve() { return true }, async request() { return [] } }
  const addr = '33 Lý Thái Tổ, P. Ninh Xá, TP. Bắc Ninh'
  const geocode = (n: string) => ({ results: [{ place_id: 'g-1', formatted_address: `${n} Lý Thái Tổ, Ninh Xá, Bắc Ninh`,
    geometry: { location: { lat: 21.1781, lng: 106.0655 } }, compound: { commune: 'Ninh Xá', district: 'Bắc Ninh', province: 'Bắc Ninh' } }] })
  let goongCalls: string[] = []
  const withGoong = (answer: (a: string) => unknown) => ({ ...vietmapMiss, async goong(a: 'geocode' | 'autocomplete' | 'detail') { goongCalls.push(a); return answer(a) } })
  const ok = await resolver.resolveAutoLocation({ id: 20, company: 'Groupe SEB', location: addr, targets: [{ address: addr, workLocationId: 7 }] }, withGoong(() => geocode('33')))
  assert(ok.kind === 'exact' && (ok as { source?: string }).source === 'Goong g-1' && ok.workLocationId === 7, 'Goong address with same house number + street + ward approved')
  goongCalls = []
  const wrongNo = await resolver.resolveAutoLocation({ id: 21, company: 'Groupe SEB', location: addr, targets: [{ address: addr, workLocationId: 7 }] }, withGoong(() => geocode('35')))
  assert(wrongNo.kind !== 'exact', 'Goong address with a different house number is never an exact pin')
  const park = findIndustrialPark('Nhà máy Quế Võ III, Bắc Ninh')!
  assert(park && insideParkOutline(park, { lat: park.lat, lng: park.lng }), 'fixture: park reference point is inside its outline')
  const company = (lat: number, lng: number) => (a: string) => a === 'autocomplete'
    ? { predictions: [{ place_id: 'g-adtek', structured_formatting: { main_text: 'ADTEK' } }] }
    : { result: { name: 'ADTEK', formatted_address: 'KCN Quế Võ III', geometry: { location: { lat, lng } } } }
  const parkAddr = 'Nhà máy Quế Võ III, Bắc Ninh'
  const inside = await resolver.resolveAutoLocation({ id: 22, company: 'ADTEK', location: parkAddr, targets: [{ address: parkAddr, workLocationId: 8 }] }, withGoong(company(park.lat, park.lng)))
  assert(inside.kind === 'exact' && (inside as { source?: string }).source === 'Goong g-adtek', 'Goong company inside the park outline approved')
  const outside = await resolver.resolveAutoLocation({ id: 23, company: 'ADTEK', location: parkAddr, targets: [{ address: parkAddr, workLocationId: 8 }] }, withGoong(company(park.lat + 0.08, park.lng + 0.08)))
  assert(outside.kind !== 'exact', 'Goong company outside the park outline is never an exact pin')
  const twoNames = await resolver.resolveAutoLocation({ id: 24, company: 'ADTEK', location: parkAddr, targets: [{ address: parkAddr, workLocationId: 8 }] },
    withGoong((a) => a === 'autocomplete' ? { predictions: [{ place_id: 'a', structured_formatting: { main_text: 'ADTEK' } }, { place_id: 'b', structured_formatting: { main_text: 'ADTEK' } }] } : null))
  assert(twoNames.kind !== 'exact', 'two same-name Goong places are never chosen')
  goongCalls = []
  const noKey = await resolver.resolveAutoLocation({ id: 25, company: 'Groupe SEB', location: addr, targets: [{ address: addr, workLocationId: 7 }] }, vietmapMiss)
  assert(noKey.kind !== 'exact' && goongCalls.length === 0, 'without a Goong key the resolver behaves as before')
  let cachedHits = 0
  await resolver.resolveAutoLocation({ id: 26, company: 'Groupe SEB', location: addr, targets: [{ address: addr, workLocationId: 7 }] },
    { ...withGoong(() => { throw new Error('upstream private message') }), async cached(k: string) { if (k.includes('goong-v1')) cachedHits++; return null } })
  assert(cachedHits >= 1, 'Goong questions are cached like VietMap ones')
  console.log('autoLocationResolver: Goong address/company-in-park assertions passed')
}

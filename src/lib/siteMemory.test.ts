// Lee 2026-11-26 "같은 공장을 다시 묻지 않게": 같은 회사 + 같은 사업장 확정 좌표(DB location_site_memory)가 있으면 Google을 부르지 않는다.
// 같은 사업장 판정 자체는 DB(supabase/tests/location_site_memory.local.sql). 여기서는 위치 확인 순서·출처·충돌 처리.
import { precheckJob, precheckVerdict } from './locationPrecheck.ts'
import { agreedSiteMemory, resolveAutoLocation } from './autoLocationResolver.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }

let asked = 0
const place = { places: [{ id: 'hj1', displayName: { text: 'Công ty TNHH Hojeong Vina' }, formattedAddress: 'Lô C3, KCN Quế Võ, Bắc Ninh', location: { latitude: 21.18, longitude: 106.07 }, types: ['establishment'] }] }
type Hit = { lat: number; lng: number; source: string }
const deps = (memory: (() => Promise<Hit[]>) | null) => ({
  async cached() { return null }, async cache() {},
  async reserve() { return true }, async request() { return [] },
  async google() { asked++; return place },
  async withinAdministrativeArea() { return true },
  ...(memory ? { siteMemory: memory } : {}),
})
const job = precheckJob({ company: 'CTY HOJEONG VINA', location: 'Bắc Ninh', addresses: ['lô C3 KCN Que Vo, Bắc Ninh'] })!

// 1) 기억이 있으면 Google을 부르지 않고 그 좌표, 원래 출처(Google)를 앞에 둔다(위치 원본 출처 표시 유지)
asked = 0
const r1 = await resolveAutoLocation(job, deps(async () => [{ lat: 21.15, lng: 106.15, source: 'Google' }]))
assert(precheckVerdict(r1).findable && asked === 0, `memory hit must skip Google (asked ${asked})`)
assert(r1.kind === 'exact' && (r1 as Hit).lat === 21.15 && /^Google .*site memory/.test(String((r1 as Hit).source)), 'memory point + Google origin: ' + JSON.stringify(r1))

// 2) 기억이 없으면 예전처럼 Google
asked = 0
const r2 = await resolveAutoLocation(job, deps(async () => []))
assert(precheckVerdict(r2).findable && asked === 1, `no memory → Google once (asked ${asked})`)

// 3) 기억 조회 실패는 '없음' — 위치 확인을 막지 않는다
asked = 0
const r3 = await resolveAutoLocation(job, deps(async () => { throw new Error('db down') }))
assert(precheckVerdict(r3).findable && asked === 1, `memory failure → Google (asked ${asked})`)

// 4) 같은 사업장 기억이 서로 다른 곳(300m 넘게)을 가리키면 쓰지 않고 Google로(다른 지점 병합 금지)
asked = 0
const r4 = await resolveAutoLocation(job, deps(async () => [{ lat: 21.15, lng: 106.15, source: 'Google' }, { lat: 21.2, lng: 106.2, source: 'VietMap' }]))
assert(asked === 1 && (r4 as Hit).lat === 21.18 && /memory:conflict/.test(String(r4.evidence ?? '')) === false, `conflict → Google place (asked ${asked})`)
assert(agreedSiteMemory([{ lat: 21.15, lng: 106.15, source: 'a' }, { lat: 21.1501, lng: 106.1501, source: 'b' }])?.source === 'a', 'close points agree')
assert(agreedSiteMemory([{ lat: 0, lng: 0, source: 'bad' }]) === null, 'invalid point is not memory')

// 5) 기억 기능이 없는 호출(예전 deps)은 그대로
asked = 0
const r5 = await resolveAutoLocation(job, deps(null))
assert(precheckVerdict(r5).findable && asked === 1, 'old deps unchanged')

console.log('siteMemory.test: all assertions passed')

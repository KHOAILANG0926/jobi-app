import { parseWardUnit, type WardUnit } from './wardArea.ts'
import { runWardLocate, pickWardHit, checkWardPlace, WARD_SEARCH_VERSION, type WardCenterCache, type WardLocateDeps } from './wardLocate.ts'
import { DailyLimitError } from './adminVietmapClient.ts'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
const unit = (raw: string) => parseWardUnit(raw) as WardUnit

const TAM_DA = unit('Xã Tam Đa, Huyện Yên Phong, Bắc Ninh')
const VO_CUONG = unit('Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh')
const DAI_DONG = unit('Xã Đại Đồng, Huyện Tiên Du, Bắc Ninh')

{
  const hits = [
    { ref_id: 'a', name: 'Xã Tam Đa', address: 'Huyện Yên Phong, Bắc Ninh' },
    { ref_id: 'b', name: 'Ủy ban nhân dân xã Tam Đa', address: 'Huyện Yên Phong, Bắc Ninh' },
  ]
  assert(pickWardHit(TAM_DA, hits).hit?.ref_id === 'a', 'exact ward name picked, the People\'s Committee POI is not')
  assert(pickWardHit(TAM_DA, [{ ref_id: 'x', name: 'Phường Tam Đa', address: 'Huyện Yên Phong, Bắc Ninh' }]).hit === null, 'phường with the same name is not an xã')
  assert(pickWardHit(TAM_DA, [{ ref_id: 'x', name: 'Xã Tam Đa', address: 'Tỉnh Khác, Hải Dương' }]).hit === null, 'same name in another province is rejected')
  const twice = pickWardHit(DAI_DONG, [
    { ref_id: '1', name: 'Xã Đại Đồng', address: 'Huyện Tiên Du, Bắc Ninh' },
    { ref_id: '2', name: 'Xã Đại Đồng', address: 'Huyện Tiên Du, Bắc Ninh' },
  ])
  assert(twice.hit === null && twice.multiple, 'two equally good matches → multiple, no pick')
  const better = pickWardHit(DAI_DONG, [
    { ref_id: '1', name: 'Xã Đại Đồng', address: 'Huyện Văn Lâm, Hưng Yên' },
    { ref_id: '2', name: 'Xã Đại Đồng', address: 'Huyện Tiên Du, Bắc Ninh' },
  ])
  assert(better.hit?.ref_id === '2', 'district + province outranks a bare province match')
  assert(pickWardHit(TAM_DA, [{ name: 'Xã Tam Đa' }]).hit === null, 'hit without ref_id is unusable')
}
{
  assert(checkWardPlace(TAM_DA, { lat: 21.2, lng: 106.0, ward: 'Xã Tam Đa', city: 'Bắc Ninh' }) === null, 'matching ward/province accepted')
  assert(checkWardPlace(TAM_DA, { lat: 21.2, lng: 106.0 }) === null, 'missing ward/city fields → no objection')
  assert(checkWardPlace(TAM_DA, { lat: 21.2, lng: 106.0, ward: 'Xã Khác' }) === 'place_mismatch', 'other ward rejected')
  assert(checkWardPlace(TAM_DA, { lat: 21.2, lng: 106.0, city: 'Hải Dương' }) === 'place_mismatch', 'other province rejected')
  assert(checkWardPlace(TAM_DA, {}) === 'place_failed', 'no coordinates')
  assert(checkWardPlace(TAM_DA, { lat: 51, lng: 0 }) === 'bad_coords', 'outside Vietnam')
}

const last = (f: { saved: WardCenterCache[] }) => f.saved[f.saved.length - 1]
type Fake = { searches: string[]; places: string[]; saved: WardCenterCache[] }
function makeDeps(opts: { initial?: WardCenterCache; limitAfter?: number; noHits?: boolean; fail?: boolean } = {}) {
  const fake: Fake = { searches: [], places: [], saved: [] }
  let used = 0
  const take = () => {
    if (opts.limitAfter !== undefined && used >= opts.limitAfter) throw new DailyLimitError(used, 250)
    used++
    return { used, limit: 250 }
  }
  const deps: WardLocateDeps = {
    async search(body) {
      const t = take()
      if (opts.fail) throw new Error('boom')
      fake.searches.push(body.text)
      if (opts.noHits) return { data: [], ...t }
      const name = body.text.split(',')[0]
      return { data: [{ ref_id: `ref:${name}`, name, address: 'Huyện Yên Phong, Bắc Ninh' }], ...t }
    },
    async place(body) { const t = take(); fake.places.push(body.refId); return { data: { lat: 21.2, lng: 106.05 }, ...t } },
    async loadCache() { return opts.initial ? structuredClone(opts.initial) : null },
    async saveCache(cache) { fake.saved.push(structuredClone(cache)) },
  }
  return { deps, fake }
}

await (async () => {
  const { deps, fake } = makeDeps()
  const s = await runWardLocate([TAM_DA, TAM_DA], deps, { usedAtStart: 0, now: () => new Date('2026-10-08T00:00:00Z') })
  assert(s.wardsTotal === 1, 'same ward listed twice is looked up once')
  assert(s.found === 1 && s.callsThisRun === 2 && fake.searches.length === 1 && fake.places.length === 1, 'one ward = Search 1 + Place 1')
  assert(s.stopped === 'done' && s.notProcessed === 0 && s.serverCallsDelta === 2, 'finished, counter delta matches')
  const saved = last(fake)
  const e = saved[TAM_DA.key]
  assert(e?.status === 'found' && e.lat === 21.2 && e.lng === 106.05, 'center cached privately under the ward key')
})()

await (async () => {
  const initial: WardCenterCache = { [TAM_DA.key]: { status: 'found', lat: 21.2, lng: 106.0, name: 'x', at: 'then' } }
  const { deps, fake } = makeDeps({ initial })
  const s = await runWardLocate([TAM_DA, VO_CUONG], deps)
  assert(s.fromCache === 1 && s.found === 1 && fake.searches.length === 1, 'cached ward is not called again')
  assert(!fake.searches.some((t) => t.startsWith('Xã Tam Đa')), 'no VietMap call for the cached ward')
  assert(last(fake)[TAM_DA.key].status === 'found' && !!last(fake)[VO_CUONG.key], 'cache keeps old entries and adds the new one')
})()

await (async () => {
  const miss: WardCenterCache = { [TAM_DA.key]: { status: 'miss', reason: 'no_exact_name', version: WARD_SEARCH_VERSION, at: 'then' } }
  const same = makeDeps({ initial: miss })
  const a = await runWardLocate([TAM_DA], same.deps)
  assert(a.fromCache === 1 && same.fake.searches.length === 0, 'a miss from the current search version is not retried')
  const old = makeDeps({ initial: { [TAM_DA.key]: { status: 'miss', reason: 'no_exact_name', version: WARD_SEARCH_VERSION - 1, at: 'then' } } })
  const b = await runWardLocate([TAM_DA], old.deps)
  assert(b.found === 1 && old.fake.searches.length === 1, 'a miss from an older search version is retried')
})()

await (async () => {
  const { deps, fake } = makeDeps({ noHits: true })
  const s = await runWardLocate([TAM_DA], deps)
  assert(s.miss === 1 && s.found === 0 && fake.searches.length === 2 && fake.places.length === 0, 'no result: full text then short text, no Place, cached as a miss')
  assert(s.callsThisRun === 2 && s.callsThisRun <= 3, 'within the per-ward call cap')
  assert(last(fake)[TAM_DA.key].status === 'miss', 'miss is cached so it is not called again')
})()

await (async () => {
  const { deps, fake } = makeDeps({ limitAfter: 3 })
  const s = await runWardLocate([TAM_DA, VO_CUONG, DAI_DONG], deps)
  assert(s.stopped === 'daily_limit' && s.remainingToday === 0, 'stops at the daily limit')
  assert(s.found === 1 && s.notProcessed === 2, 'finished wards counted, the rest stay unprocessed')
  assert(last(fake)[TAM_DA.key]?.status === 'found', 'progress is saved before stopping')
})()

await (async () => {
  const { deps } = makeDeps({ fail: true })
  const s = await runWardLocate([TAM_DA, VO_CUONG, DAI_DONG, unit('Xã Liên Bão, Huyện Tiên Du, Bắc Ninh'), unit('Xã Tiên Du, Huyện Tiên Du, Bắc Ninh'), unit('Xã Tân Chi, Huyện Tiên Du, Bắc Ninh')], deps)
  assert(s.stopped === 'error' && s.lookupFailed === 5 && s.notProcessed === 6, 'repeated failures stop the run; failed wards stay unprocessed')
})()

console.log('wardLocate tests: all assertions passed')

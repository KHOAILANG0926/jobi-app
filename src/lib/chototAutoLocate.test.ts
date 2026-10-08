import { runAutoLocate, judgePois, queryKey, districtOf, reportJobLoad, CHOTOT_EXPECTED_TOTAL, type AutoLocateDeps, type AutoLocateJob, type SearchCache } from './chototAutoLocate.ts'
import { DailyLimitError } from './adminVietmapClient.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const ADDR = 'Số 1, Xã Long Châu, Huyện Yên Phong, Tỉnh Bắc Ninh'
const OTHER = 'Số 9, Phường Dịch Vọng, Quận Cầu Giấy, Thành phố Hà Nội'
const UNITS = { ward: 'Xã Long Châu', district: 'Huyện Yên Phong', city: 'Tỉnh Bắc Ninh' }

type Place = { name: string; lat: number; lng: number; ward?: string; district?: string; city?: string }
function makeDeps(places: Record<string, Place[]>, opts: { limitAfter?: number; cache?: SearchCache } = {}) {
  const state = { searches: 0, places: 0, added: [] as number[], approved: [] as number[], saved: 0, cache: opts.cache ?? ({} as SearchCache), nextId: 500 }
  const detail: Record<string, Place> = {}
  const deps: AutoLocateDeps = {
    async search(body) {
      if (opts.limitAfter !== undefined && state.searches + state.places >= opts.limitAfter) throw new DailyLimitError(250, 250)
      state.searches++
      const hits = (places[body.text] ?? []).map((p, i) => { const ref = `${body.text}#${i}`; detail[ref] = p; return { ref_id: ref, name: p.name } })
      return { data: hits, used: state.searches + state.places, limit: 250 }
    },
    async place(body) {
      if (opts.limitAfter !== undefined && state.searches + state.places >= opts.limitAfter) throw new DailyLimitError(250, 250)
      state.places++
      return { data: detail[body.refId], used: state.searches + state.places, limit: 250 }
    },
    async addCandidate(input) { state.added.push(input.jobId); return { id: state.nextId++ } },
    async approve(id) { state.approved.push(id) },
    async loadCache() { return Object.keys(state.cache).length ? state.cache : null },
    async saveCache(c) { state.saved++; state.cache = c },
  }
  return { deps, state }
}

const job = (id: number, company: string, address = ADDR, existing: AutoLocateJob['existing'] = []): AutoLocateJob => ({
  id, company, location: address, targets: [{ workLocationId: id * 10, address, focus: null }], existing,
})
const q = (company: string, address = ADDR) => `${company} ${districtOf(address)}`
const poi = (name: string, extra: Partial<Place> = {}): Place => ({ name, lat: 21.2, lng: 106.05, ...UNITS, ...extra })

assert(districtOf(ADDR) === 'Xã Long Châu, Huyện Yên Phong, Tỉnh Bắc Ninh' && queryKey('A', ADDR).includes('|'), 'query is built from the district part only')

{
  const { deps, state } = makeDeps({
    [q('Goertek Vina')]: [poi('Goertek Vina')],
    [q('Pizza Việt Nam')]: [poi('Công Ty Tnhh Pizza Việt Nam')],
    [q('Acme')]: [poi('Acme'), poi('Acme', { lat: 21.21 })],
    [q('Foo Bar')]: [poi('Foo Bar Plus')],
    [q('Moved Co', OTHER)]: [poi('Moved Co')],
    [q('Nobody')]: [],
  })
  const r = await runAutoLocate([
    job(1, 'Goertek Vina'), job(2, 'Pizza Việt Nam'), job(3, 'Acme'), job(4, 'Foo Bar'), job(5, 'Moved Co', OTHER), job(6, 'Nobody'), job(7, ''),
  ], deps)
  const by = Object.fromEntries(r.outcomes.map((o) => [o.jobId, o]))
  assert(by[1].status === 'approved' && state.added.includes(1) && state.approved.length === 1, 'exact name inside the address district → approved coordinate')
  assert(by[2].status === 'no_pin' && by[2].reason === 'registered_address_like', 'legal-name POI (registered address) is excluded')
  assert(by[3].status === 'no_pin' && by[3].reason === 'multiple_exact', 'several exact-name POIs (branches) → no pin')
  assert(by[4].status === 'no_pin' && by[4].reason === 'name_not_exact', 'similar-but-not-exact name → no pin')
  assert(by[5].status === 'no_pin' && by[5].reason === 'address_not_inside', 'exact name but POI outside the address district → no pin')
  assert(by[6].reason === 'no_search_result' && by[7].reason === 'no_company', 'nothing found / no company → no pin')
  assert(r.searched === 7 && r.autoApproved === 1 && r.noPin === 6 && r.stopped === 'done' && r.notProcessed === 0, 'summary counts')
  assert(r.callsThisRun === state.searches + state.places && r.remainingToday === 250 - r.callsThisRun, 'remaining calls come from the server counter')
  assert(state.added.length === 1 && state.approved.length === 1, 'only the auto-approved one is written')
  assert(state.saved >= 1, 'search cache saved to the private store')

  const second = makeDeps({}, { cache: state.cache })
  const again = await runAutoLocate([job(2, 'Pizza Việt Nam'), job(6, 'Nobody')], second.deps)
  assert(again.callsThisRun === 0 && second.state.searches === 0 && again.noPin === 2 && again.remainingToday === null, 'cached queries are not called again')
}
{
  const { deps, state } = makeDeps({ [q('A1')]: [poi('A1')], [q('A2')]: [poi('A2')], [q('A3')]: [poi('A3')] }, { limitAfter: 4 })
  const r = await runAutoLocate([job(1, 'A1'), job(2, 'A2'), job(3, 'A3')], deps)
  assert(r.stopped === 'daily_limit' && r.remainingToday === 0, 'daily limit stops the run')
  assert(r.autoApproved === 2 && r.notProcessed === 1 && r.searched === 2, 'finished jobs kept, the rest left for tomorrow')
  assert(state.saved >= 1 && Object.keys(state.cache).length === 2, 'cache saved so tomorrow continues without repeating calls')
  const next = makeDeps({ [q('A3')]: [poi('A3')] }, { cache: state.cache })
  const resumed = await runAutoLocate([job(1, 'A1', ADDR, [{ id: 500, address_snapshot: ADDR, lat: 21.2, lng: 106.05, status: 'approved' }]), job(2, 'A2', ADDR, [{ id: 501, address_snapshot: ADDR, lat: 21.2, lng: 106.05, status: 'approved' }]), job(3, 'A3')], next.deps)
  assert(resumed.alreadyApproved === 2 && resumed.autoApproved === 1 && next.state.searches === 1, 'next day resumes: approved jobs skipped, only the remaining one is searched')
}
{
  const { deps, state } = makeDeps({ [q('B1')]: [poi('B1')], [q('B2')]: [poi('B2')], [q('B3')]: [poi('B3')] })
  const same = { address_snapshot: ADDR, lat: 21.2, lng: 106.05 }
  const r = await runAutoLocate([
    job(1, 'B1', ADDR, [{ id: 11, status: 'pending', ...same }]),
    job(2, 'B2', ADDR, [{ id: 12, status: 'rejected', ...same }]),
    job(3, 'B3', ADDR, [{ id: 13, status: 'revoked', ...same }]),
  ], deps)
  assert(state.approved.join() === '11' && state.added.length === 0, 'existing pending candidate at the same spot is approved, no duplicate created')
  assert(r.outcomes[1].reason === 'previously_rejected' && r.outcomes[2].reason === 'previously_rejected', 'rejected/revoked decisions are respected')
}
{
  const failing: AutoLocateDeps = { ...makeDeps({}).deps, async search() { throw new Error('boom') } }
  const r = await runAutoLocate([job(1, 'X')], failing)
  assert(r.noPin === 1 && r.outcomes[0].reason === 'lookup_failed' && r.stopped === 'done', 'a failed lookup is a no-pin, not a crash')
  const j = judgePois('Goertek Vina', { address: ADDR, location: ADDR }, { hits: 1, pois: [] })
  assert(j.approvePoi === null && j.reason === 'no_search_result', 'judgePois with no POI')
}
{
  const { deps } = makeDeps({ [q('S1')]: [poi('S1')], [q('S2')]: [poi('S2')] })
  let n = 0
  const r = await runAutoLocate([job(1, 'S1'), job(2, 'S2')], deps, { shouldStop: () => n++ >= 1 })
  assert(r.stopped === 'user' && r.autoApproved === 1 && r.notProcessed === 1, 'stop button halts between jobs')
}

{
  // 100건을 모두 읽어 모두 판정했을 때만 "done".
  const places: Record<string, Place[]> = {}
  const all = Array.from({ length: 100 }, (_, i) => job(4685 + i, `Co ${i}`))
  const { deps } = makeDeps(places)
  const full = await runAutoLocate(all, deps, { expectedTotal: CHOTOT_EXPECTED_TOTAL })
  assert(full.searched === 100 && full.jobsFound === 100 && full.notProcessed === 0 && full.stopped === 'done', '100 of 100 judged → done')
  assert(full.noPin === 100 && full.autoApproved === 0, 'counts are per job')

  // 4건만 읽혔다면(조회 누락) 4건을 처리해도 "done"이 아니라 incomplete, 나머지 96건은 chưa xử lý.
  const partial = await runAutoLocate(all.slice(0, 4), makeDeps(places).deps, { expectedTotal: CHOTOT_EXPECTED_TOTAL })
  assert(partial.searched === 4 && partial.jobsTotal === 100 && partial.notProcessed === 96 && partial.stopped === 'incomplete', 'only 4 of 100 read → incomplete, 96 not processed')

  // 한도로 끊기면 끊긴 공고부터 전부 chưa xử lý에 포함.
  const limited = await runAutoLocate(all.slice(0, 10), makeDeps(places, { limitAfter: 3 }).deps, { expectedTotal: 100 })
  assert(limited.stopped === 'daily_limit' && limited.searched === 3 && limited.notProcessed === 97, 'daily limit: unfinished jobs counted as not processed')

  // 한 공고에 근무지가 여러 개여도 공고 1건으로 센다.
  const multi: AutoLocateJob = { id: 1, company: 'Multi', location: ADDR, existing: [], targets: [{ workLocationId: 1, address: ADDR, focus: null }, { workLocationId: 2, address: OTHER, focus: null }] }
  const m = await runAutoLocate([multi], makeDeps({}).deps)
  assert(m.searched === 1 && m.noPin === 1 && m.outcomes.length === 2, 'job counted once, details per address')
}
{
  const rep = reportJobLoad([{ id: 4685, admin_hidden: true }, { id: 4686, admin_hidden: false }, { id: 4700, admin_hidden: true }])
  assert(rep.found === 3 && rep.hidden === 2 && rep.visible === 1 && rep.missingCount === 97 && rep.missingIds.length === 20 && rep.missingIds[0] === 4687, 'load report lists what was not read')
  const none = reportJobLoad(Array.from({ length: 100 }, (_, i) => ({ id: 4685 + i })))
  assert(none.missingCount === 0 && none.found === 100, 'full read has nothing missing')
}

console.log('chototAutoLocate tests: all assertions passed')

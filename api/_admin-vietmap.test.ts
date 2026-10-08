import { createAdminVietmapHandler, DAILY_LIMIT, vietnamDay } from './admin-vietmap.js'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const SECRET = 'SECRET-VIETMAP-KEY-VALUE'

function makeRes() {
  const res: { code: number; body: unknown; headers: Record<string, string>; status: (c: number) => typeof res; json: (b: unknown) => typeof res; setHeader: (k: string, v: string) => void } = {
    code: 0, body: null, headers: {},
    status(c) { res.code = c; return res },
    json(b) { res.body = b; return res },
    setHeader(k, v) { res.headers[k] = v },
  }
  return res
}

function makeDeps(opts: { role?: string; configured?: boolean; used?: number; counterFails?: boolean; upstreamOk?: boolean } = {}) {
  const calls = { upstream: 0, take: 0, read: 0, urls: [] as string[] }
  let used = opts.used ?? 0
  const deps = {
    vietmapConfigured: () => opts.configured ?? true,
    async verifyCaller(token: string) {
      if (token !== 'good') throw new Error('Invalid access token')
      return { app_metadata: { role: opts.role ?? 'admin' } }
    },
    async takeUsage(_day: string, limit: number) {
      calls.take++
      if (opts.counterFails) throw new Error('usage_counter_unavailable')
      if (used >= limit) return { ok: false, used }
      used++
      return { ok: true, used }
    },
    async readUsage(_day: string) {
      calls.read++
      if (opts.counterFails) throw new Error('usage_counter_unavailable')
      return { used }
    },
    async upstream(url: string, params: Record<string, string>) {
      calls.upstream++
      calls.urls.push(`${url}?${new URLSearchParams(params)}`)
      return opts.upstreamOk === false ? { ok: false, status: 423 } : { ok: true, status: 200, json: [{ ref_id: 'r1', name: 'Pizza Hut' }] }
    },
  }
  return { deps, calls }
}

async function run(deps: ReturnType<typeof makeDeps>['deps'], req: { method?: string; headers?: Record<string, string>; body?: unknown }) {
  const res = makeRes()
  await createAdminVietmapHandler(deps)({ method: 'POST', headers: { authorization: 'Bearer good' }, ...req } as never, res as never)
  return res
}

{
  const { deps, calls } = makeDeps()
  const r = await run(deps, { method: 'GET' })
  assert(r.code === 405 && calls.upstream === 0, 'GET rejected')
  const noAuth = await run(deps, { headers: {}, body: { action: 'search', text: 'x' } })
  assert(noAuth.code === 401 && calls.upstream === 0, 'no token → 401, no upstream call')
  const bad = await run(deps, { headers: { authorization: 'Bearer nope' }, body: { action: 'search', text: 'x' } })
  assert(bad.code === 401 && calls.upstream === 0, 'bad token → 401')
}
{
  const { deps, calls } = makeDeps({ role: 'employer' })
  const r = await run(deps, { body: { action: 'search', text: 'Pizza Hut' } })
  assert(r.code === 403 && calls.upstream === 0 && calls.take === 0, 'non-admin → 403, nothing counted or called')
}
{
  const { deps, calls } = makeDeps()
  for (const body of [{}, { action: 'search' }, { action: 'search', text: 'x'.repeat(201) }, { action: 'place', refId: 'a b' }, { action: 'search', text: 'x', focus: { lat: 50, lng: 105 } }, { action: 'other' }]) {
    const r = await run(deps, { body })
    assert(r.code === 400, `invalid body rejected: ${JSON.stringify(body).slice(0, 40)}`)
  }
  assert(calls.upstream === 0, 'invalid requests never reach upstream')
}
{
  const { deps, calls } = makeDeps()
  const r = await run(deps, { body: { action: 'search', text: 'Pizza Hut Bắc Ninh', focus: { lat: 21.17, lng: 106.06 } } })
  assert(r.code === 200 && (r.body as { ok: boolean }).ok === true, 'admin search ok')
  assert(calls.urls[0].startsWith('https://maps.vietmap.vn/api/search/v4?') && calls.urls[0].includes('focus=21.17%2C106.06'), 'search url + focus')
  assert(!JSON.stringify(r.body).toLowerCase().includes('apikey') && !JSON.stringify(r.body).includes(SECRET), 'response has no key')
  assert(r.headers['Cache-Control'] === 'no-store', 'no-store')
  const p = await run(deps, { body: { action: 'place', refId: 'abc123' } })
  assert(p.code === 200 && calls.urls[1].startsWith('https://maps.vietmap.vn/api/place/v4?refid=abc123'), 'place url')
}
{
  const { deps, calls } = makeDeps({ used: DAILY_LIMIT })
  const r = await run(deps, { body: { action: 'search', text: 'x' } })
  assert(r.code === 429 && calls.upstream === 0, `limit ${DAILY_LIMIT} reached → 429 and upstream not called`)
  assert(DAILY_LIMIT === 250, 'daily limit is 250')
}
{
  const { deps, calls } = makeDeps({ counterFails: true })
  const r = await run(deps, { body: { action: 'search', text: 'x' } })
  assert(r.code === 503 && calls.upstream === 0, 'counter unavailable → fail closed')
  const { deps: d2, calls: c2 } = makeDeps({ configured: false })
  const r2 = await run(d2, { body: { action: 'search', text: 'x' } })
  assert(r2.code === 503 && c2.upstream === 0 && c2.take === 0, 'key not configured → 503, nothing counted')
}
{
  const { deps } = makeDeps({ upstreamOk: false })
  const r = await run(deps, { body: { action: 'search', text: 'x' } })
  assert(r.code === 502 && (r.body as { upstreamStatus: number }).upstreamStatus === 423, 'upstream failure → 502 with status only')
}
{
  const { deps, calls } = makeDeps({ used: 37, configured: false })
  const r = await run(deps, { body: { action: 'usage' } })
  const body = r.body as { ok: boolean; used: number; limit: number }
  assert(r.code === 200 && body.used === 37 && body.limit === DAILY_LIMIT, 'usage action returns today used/limit')
  assert(calls.upstream === 0 && calls.take === 0 && calls.read === 1, 'usage never calls VietMap and does not count')
  const denied = await run(makeDeps({ role: 'employer' }).deps, { body: { action: 'usage' } })
  assert(denied.code === 403, 'usage is admin only')
  const none = await run(makeDeps().deps, { headers: {}, body: { action: 'usage' } })
  assert(none.code === 401, 'usage needs a token')
  const broken = await run(makeDeps({ counterFails: true }).deps, { body: { action: 'usage' } })
  assert(broken.code === 503, 'usage counter unavailable → 503')
}
{
  const { deps, calls } = makeDeps()
  await run(deps, { body: { action: 'search', text: 'Xã Tam Đa, Bắc Ninh', any: true } })
  await run(deps, { body: { action: 'search', text: 'Pizza Hut' } })
  assert(!calls.urls[0].includes('layers=') && calls.urls[1].includes('layers=POI'), 'any=true searches all layers; default stays POI-only')
  assert(calls.take === 2 && calls.upstream === 2, 'both kinds are counted')
}
assert(vietnamDay(new Date('2026-10-07T18:00:00Z')) === '2026-10-08', 'Vietnam day rolls at UTC+7')

console.log('admin-vietmap api tests: all assertions passed')

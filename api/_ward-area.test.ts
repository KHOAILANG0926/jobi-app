import { createWardAreaHandler } from './ward-area.js'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }

function makeRes() {
  const res: { code: number; body: unknown; headers: Record<string, string>; status: (c: number) => typeof res; json: (b: unknown) => typeof res; setHeader: (k: string, v: string) => void } = {
    code: 0, body: null, headers: {},
    status(c) { res.code = c; return res },
    json(b) { res.body = b; return res },
    setHeader(k, v) { res.headers[k] = v },
  }
  return res
}

const KEY = 'xa:tam da|yen phong|bac ninh'
const cache = {
  [KEY]: { status: 'found', lat: 21.2, lng: 106.05, name: 'Xã Tam Đa', at: 'then' },
  'phuong:vo cuong|bac ninh|bac ninh': { status: 'miss', reason: 'no_exact_name', version: 1, at: 'then' },
  'xa:far away|a|b': { status: 'found', lat: 51, lng: 0, name: 'x', at: 'then' },
}

async function run(req: { method?: string; query?: Record<string, unknown> }, payload: unknown = cache, fail = false) {
  const res = makeRes()
  let reads = 0
  const deps = { async readCache() { reads++; if (fail) throw new Error('cache_unavailable'); return payload } }
  await createWardAreaHandler(deps)({ method: 'GET', ...req } as never, res as never)
  return { res, reads }
}

{
  const { res } = await run({ query: { key: KEY } })
  const body = res.body as { found: boolean; lat: number; lng: number; name?: string }
  assert(res.code === 200 && body.found && body.lat === 21.2 && body.lng === 106.05, 'cached ward returns only its center')
  assert(Object.keys(body).sort().join() === 'found,lat,lng', 'nothing else from the private store leaks')
  assert(res.headers['Cache-Control'].includes('s-maxage'), 'found answers are CDN cacheable')
}
{
  const miss = await run({ query: { key: 'phuong:vo cuong|bac ninh|bac ninh' } })
  assert(miss.res.code === 200 && (miss.res.body as { found: boolean }).found === false, 'a cached miss → found:false')
  const absent = await run({ query: { key: 'xa:khong co|a|b' } })
  assert((absent.res.body as { found: boolean }).found === false, 'unknown ward → found:false')
  const far = await run({ query: { key: 'xa:far away|a|b' } })
  assert((far.res.body as { found: boolean }).found === false, 'coordinates outside Vietnam are never returned')
  const proto = await run({ query: { key: 'xa:constructor|a|b' } })
  assert((proto.res.body as { found: boolean }).found === false, 'inherited object properties are not entries')
  const empty = await run({ query: { key: KEY } }, null)
  assert((empty.res.body as { found: boolean }).found === false, 'empty store → found:false')
}
{
  for (const key of [undefined, '', 'bad', 'xa:a|b', "xa:tam da|yen phong|bac ninh'; drop", ['a', 'b'], 'xa:' + 'a'.repeat(80) + '|b|c']) {
    const r = await run({ query: { key } })
    assert(r.res.code === 400 && r.reads === 0, `invalid key rejected without reading the store: ${String(key).slice(0, 20)}`)
  }
  const post = await run({ method: 'POST', query: { key: KEY } })
  assert(post.res.code === 405 && post.reads === 0, 'only GET')
  const broken = await run({ query: { key: KEY } }, cache, true)
  assert(broken.res.code === 503 && broken.res.headers['Cache-Control'] === 'no-store', 'store failure → 503, not cached')
}
console.log('ward-area api tests: all assertions passed')

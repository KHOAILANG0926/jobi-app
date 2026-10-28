import { createAdminBusinessSearchHandler, validate, normalizeHits, normalizeDetail } from './_lib/admin-business-search.js'
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
function makeRes() {
  const res: { code: number; body: any; headers: Record<string, string>; status: (c: number) => typeof res; json: (b: unknown) => typeof res; setHeader: (k: string, v: string) => void } = {
    code: 0, body: null, headers: {}, status(c) { res.code = c; return res }, json(b) { res.body = b; return res }, setHeader(k, v) { res.headers[k] = v },
  }
  return res
}
const urls: string[] = []
const deps = (key = 'SECRET-KEY', search: unknown = [{ ref_id: 'r1', name: 'Bomunttl' }], detail: unknown = { lat: 21.17, lng: 106.06, display: 'Ngô Tất Tố, Võ Cường, Bắc Ninh' }) => ({
  key: () => key,
  async fetchJson(url: string) { urls.push(url); return { ok: true, json: url.includes('/search/') || url.includes('AutoComplete') ? search : detail } },
})
const req = (body: unknown) => ({ method: 'POST', headers: {}, body })
assert(validate({ provider: 'vietmap', company: 'Bomunttl', area: 'Ngô Tất Tố - TP. Bắc Ninh' })?.text === 'Bomunttl Ngô Tất Tố - TP. Bắc Ninh', 'company + original area query')
assert(validate({ provider: 'tomtom', company: 'x' }) === null && validate({ provider: 'goong', company: '' }) === null, 'invalid input rejected')

let res = makeRes()
await createAdminBusinessSearchHandler(deps())(req({ provider: 'vietmap', company: 'Bomunttl', area: 'TP. Bắc Ninh' }), res)
assert(res.code === 200 && res.body.found && res.body.calls === 2 && res.body.lat === 21.17, 'single exact VietMap POI resolved in two calls')
assert(!JSON.stringify(res.body).includes('SECRET-KEY') && !JSON.stringify(res.body).includes('maps.vietmap.vn'), 'no key or upstream URL in response')
assert(urls[0].includes('layers=POI'), 'VietMap business (POI) search')

res = makeRes()
await createAdminBusinessSearchHandler(deps('K', [{ ref_id: 'a', name: 'Bomunttl' }, { ref_id: 'b', name: 'Bomunttl' }]))(req({ provider: 'vietmap', company: 'Bomunttl', area: '' }), res)
assert(res.code === 200 && !res.body.found && res.body.exactCount === 2 && res.body.calls === 1, 'two same-name candidates: no detail call, not found')

res = makeRes(); urls.length = 0
const goongSearch = { predictions: [{ place_id: 'g1', structured_formatting: { main_text: 'Bomunttl' } }] }
const goongDetail = { result: { geometry: { location: { lat: 21.172, lng: 106.059 } }, formatted_address: '30 Ngô Tất Tố, Võ Cường, Bắc Ninh' } }
await createAdminBusinessSearchHandler(deps('G', goongSearch, goongDetail))(req({ provider: 'goong', company: 'Bomunttl', area: 'TP. Bắc Ninh' }), res)
assert(res.code === 200 && res.body.found && res.body.address.startsWith('30 Ngô Tất Tố') && urls[0].includes('rsapi.goong.io/Place/AutoComplete'), 'Goong place search normalized')

res = makeRes()
await createAdminBusinessSearchHandler(deps(''))(req({ provider: 'goong', company: 'Bomunttl' }), res)
assert(res.code === 503 && res.body.error === 'not_configured' && res.body.provider === 'goong', 'missing Vercel key reported without value')

res = makeRes()
await createAdminBusinessSearchHandler({ key: () => 'K', async fetchJson() { return { ok: false, status: 401 } } })(req({ provider: 'vietmap', company: 'X' }), res)
assert(res.code === 502 && res.body.upstreamStatus === 401, 'upstream status only, no body')
assert(normalizeHits('goong', null).length === 0 && normalizeDetail('vietmap', null).lat === undefined, 'empty responses are safe')
console.log('admin business-search: exact single candidate, multiple, Goong normalize, missing key, upstream error, no key leak passed')

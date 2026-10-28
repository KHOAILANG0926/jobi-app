import { readFileSync } from 'node:fs'
import { createAdminBusinessSearchHandler, validate, normalizeHits, normalizeDetail } from './_lib/admin-business-search.js'
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
function makeRes() {
  const res: { code: number; body: any; headers: Record<string, string>; status: (c: number) => typeof res; json: (b: unknown) => typeof res; setHeader: (k: string, v: string) => void } = {
    code: 0, body: null, headers: {}, status(c) { res.code = c; return res }, json(b) { res.body = b; return res }, setHeader(k, v) { res.headers[k] = v },
  }
  return res
}
// 2026-10-28 regression: a src/*.ts import made the whole api/admin.js fail to start on Vercel.
for (const f of ['api/admin.js', 'api/_lib/admin-business-search.js'])
  assert(!/from\s+['"][^'"]*\/src\/[^'"]*\.ts['"]/.test(readFileSync(f, 'utf8')), `${f} must not import src TypeScript directly`)
const urls: string[] = []
const deps = (key = 'SECRET-KEY', json: unknown = [{ ref_id: 'r1', name: 'Bomunttl' }]) => ({
  key: () => key, async fetchJson(url: string) { urls.push(url); return { ok: true, json } },
})
const req = (body: unknown) => ({ method: 'POST', headers: {}, body })
assert(validate({ provider: 'vietmap', company: 'Bomunttl', area: 'Ngô Tất Tố - TP. Bắc Ninh' })?.text === 'Bomunttl Ngô Tất Tố - TP. Bắc Ninh', 'company + original area query')
assert(validate({ provider: 'goong', id: 'g1' })?.id === 'g1', 'detail by id')
assert(validate({ provider: 'vietmap', id: 'x'.repeat(600) })?.id.length === 600, 'long VietMap ref_id accepted')
assert(validate({ provider: 'tomtom', company: 'x' }) === null && validate({ provider: 'goong', company: '' }) === null, 'invalid input rejected')

let res = makeRes()
await createAdminBusinessSearchHandler(deps())(req({ provider: 'vietmap', company: 'Bomunttl', area: 'TP. Bắc Ninh' }), res)
assert(res.code === 200 && res.body.hits[0].name === 'Bomunttl' && urls[0].includes('layers=POI'), 'VietMap business search returns names/ids only')
assert(!JSON.stringify(res.body).includes('SECRET-KEY') && !JSON.stringify(res.body).includes('maps.vietmap.vn'), 'no key or upstream URL in response')
res = makeRes()
await createAdminBusinessSearchHandler(deps('K', { lat: 21.17, lng: 106.06, display: 'Ngô Tất Tố, Võ Cường, Bắc Ninh' }))(req({ provider: 'vietmap', id: 'r1' }), res)
assert(res.code === 200 && res.body.found && res.body.lat === 21.17 && res.body.address.includes('Ngô Tất Tố'), 'VietMap detail normalized')
res = makeRes(); urls.length = 0
await createAdminBusinessSearchHandler(deps('G', { predictions: [{ place_id: 'g1', structured_formatting: { main_text: 'Bomunttl' } }] }))(req({ provider: 'goong', company: 'Bomunttl', area: 'TP. Bắc Ninh' }), res)
assert(res.body.hits[0].id === 'g1' && urls[0].includes('rsapi.goong.io/Place/AutoComplete'), 'Goong place search normalized')
res = makeRes()
await createAdminBusinessSearchHandler(deps('G', { result: { geometry: { location: { lat: 21.172, lng: 106.059 } }, formatted_address: '30 Ngô Tất Tố' } }))(req({ provider: 'goong', id: 'g1' }), res)
assert(res.body.found && res.body.address === '30 Ngô Tất Tố', 'Goong detail normalized')
res = makeRes()
await createAdminBusinessSearchHandler(deps(''))(req({ provider: 'goong', company: 'Bomunttl' }), res)
assert(res.code === 503 && res.body.error === 'not_configured' && res.body.provider === 'goong', 'missing Vercel key reported without value')
res = makeRes()
await createAdminBusinessSearchHandler({ key: () => 'K', async fetchJson() { return { ok: false, status: 401 } } })(req({ provider: 'vietmap', company: 'X' }), res)
assert(res.code === 502 && res.body.upstreamStatus === 401, 'upstream status only, no body')
assert(normalizeHits('goong', null).length === 0 && normalizeDetail('vietmap', null).lat === undefined, 'empty responses are safe')
res = makeRes(); urls.length = 0
await createAdminBusinessSearchHandler(deps('K', [{ ref_id: 's1', name: 'Ngô Tất Tố', address: 'Võ Cường, Bắc Ninh', categories: ['street'] }]))(req({ provider: 'vietmap', kind: 'street', company: 'Ngô Tất Tố', area: 'TP. Bắc Ninh' }), res)
assert(res.code === 200 && !urls[0].includes('layers=POI') && res.body.hits[0].address === 'Võ Cường, Bắc Ninh', 'street search is not limited to businesses and returns the hit address')
assert(validate({ provider: 'goong', kind: 'street', company: 'x' }) === null, 'street search is VietMap only')
console.log('admin business-search: no TS import, search/detail split, Goong normalize, missing key, upstream error, no key leak passed')

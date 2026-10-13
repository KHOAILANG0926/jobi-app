import { createAdminGeocodeHandler, normalize, upstreamUrl, validate } from './admin-geocode.js'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }

function makeRes() {
  const res: { code: number; body: any; headers: Record<string, string>; status: (c: number) => typeof res; json: (b: unknown) => typeof res; setHeader: (k: string, v: string) => void } = {
    code: 0, body: null, headers: {},
    status(c) { res.code = c; return res },
    json(b) { res.body = b; return res },
    setHeader(k, v) { res.headers[k] = v },
  }
  return res
}

const tomtomJson = { results: [{ type: 'Point Address', address: { freeformAddress: '37 Lý Thái Tổ, Bắc Ninh', streetNumber: '37', streetName: 'Lý Thái Tổ', municipalitySubdivision: 'Võ Cường' }, position: { lat: 21.18, lon: 106.06 } }] }
let fetchedUrl = ''
const deps = (role: string, key = 'SECRET') => ({
  key: () => key,
  async verifyCaller() { return { app_metadata: { role } } },
  async fetchJson(url: string) { fetchedUrl = url; return { ok: true, json: tomtomJson } },
})
const req = (body: unknown, auth = 'Bearer t') => ({ method: 'POST', headers: { authorization: auth }, body })

// 입력 검증
assert(validate({ provider: 'tomtom', text: '37 Lý Thái Tổ' }) !== null, 'valid tomtom')
assert(validate({ provider: 'vietmap', text: 'x' }) === null, 'unknown provider rejected')
assert(validate({ provider: 'goong', text: '' }) === null, 'empty text rejected')

// URL에 키·주소가 들어가고 공급자별 주소가 맞다
assert(upstreamUrl('tomtom', '37 Lý', 'K').startsWith('https://api.tomtom.com/search/2/geocode/'), 'tomtom url')
assert(upstreamUrl('goong', '37 Lý', 'K').startsWith('https://rsapi.goong.io/v2/geocode?'), 'goong url')

// 정리된 결과에 번지·도로가 남는다
const n = normalize('tomtom', tomtomJson)
assert(n[0].houseNumber === '37' && n[0].street === 'Lý Thái Tổ' && n[0].lat === 21.18, 'tomtom normalize')

{ // 관리자 성공 — 응답에 키가 없다
  const res = makeRes()
  await createAdminGeocodeHandler(deps('admin'))(req({ provider: 'tomtom', text: '37 Lý Thái Tổ' }), res)
  assert(res.code === 200 && res.body.results.length === 1, 'admin ok')
  assert(!JSON.stringify(res.body).includes('SECRET'), 'key not in response')
  assert(fetchedUrl.includes('SECRET'), 'key sent upstream only')
}
{ // 관리자가 아니면 거부
  const res = makeRes()
  await createAdminGeocodeHandler(deps('user'))(req({ provider: 'tomtom', text: 'x' }), res)
  assert(res.code === 403, 'non-admin 403')
}
{ // 토큰 없으면 거부
  const res = makeRes()
  await createAdminGeocodeHandler(deps('admin'))(req({ provider: 'tomtom', text: 'x' }, ''), res)
  assert(res.code === 401, 'no token 401')
}
{ // 키가 없으면 503
  const res = makeRes()
  await createAdminGeocodeHandler(deps('admin', ''))(req({ provider: 'goong', text: 'x' }), res)
  assert(res.code === 503, 'missing key 503')
}
console.log('admin-geocode: ok')

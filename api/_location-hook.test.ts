import { createLocationHookHandler } from './location-hook.js'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
function makeRes() {
  const res: { code: number; body: unknown; setHeader: (k: string, v: string) => void; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    code: 0, body: null, setHeader() {}, status(c) { res.code = c; return res }, json(b) { res.body = b; return res } }
  return res
}
let ran: number[] = []
let forced: boolean[] = []
const deps = { async tokenOk(t: string) { return t === 'good-token-good-token-good-token-1' }, async run(id: number, force: boolean) { ran.push(id); forced.push(force); return { processed: 1 } } }
const call = async (req: Record<string, unknown>) => { const res = makeRes(); await createLocationHookHandler(deps)(req as never, res as never); return res }
assert((await call({ method: 'GET' })).code === 405, 'POST only')
assert((await call({ method: 'POST', headers: {}, body: { job_id: 1 } })).code === 400, 'token required')
assert((await call({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { job_id: 'abc' } })).code === 400, 'job id must be a number')
assert((await call({ method: 'POST', headers: { authorization: 'Bearer wrong' }, body: { job_id: 4828 } })).code === 401 && ran.length === 0, 'wrong token → no lookup')
const ok = await call({ method: 'POST', headers: { authorization: 'Bearer good-token-good-token-good-token-1' }, body: '{"job_id":4828}' })
assert(ok.code === 200 && ran[0] === 4828 && forced[0] === true, 'valid token re-judges exactly that job with current rules')
const f = await call({ method: 'POST', headers: { authorization: 'Bearer good-token-good-token-good-token-1' }, body: { job_id: 7, force: true } })
assert(f.code === 200 && forced[1] === true, 'retry also re-judges')
const broken = createLocationHookHandler({ async tokenOk() { throw new Error('db') }, async run() { return {} } })
const r = makeRes(); await broken({ method: 'POST', headers: { authorization: 'Bearer good' }, body: { job_id: 1 } } as never, r as never)
assert(r.code === 503, 'storage failure → 503')
// 수집 첫 단계 위치 확인(Lee 2026-11-06): 서버 키로만, 결과(찾을 수 있음/없음)만 돌려준다
let asked: unknown = null
const pre = { ...deps, serviceKeyOk: (t: string) => t === 'service-key', async precheck(input: unknown) { asked = input; return { findable: true, kind: 'area', reason: 'google_company_place' } } }
const pcall = async (req: Record<string, unknown>) => { const res = makeRes(); await createLocationHookHandler(pre)(req as never, res as never); return res }
const body = { precheck: { company: 'NEW TEAM ROBOTICS VIETNAM', location: 'Bắc Ninh', addresses: ['NX 2-2, KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh'] } }
assert((await pcall({ method: 'POST', headers: {}, body })).code === 400 && asked === null, 'precheck needs a key')
assert((await pcall({ method: 'POST', headers: { authorization: 'Bearer wrong' }, body })).code === 401 && asked === null, 'wrong key → no lookup')
const pok = await pcall({ method: 'POST', headers: { authorization: 'Bearer service-key' }, body })
assert(pok.code === 200 && (pok.body as { findable: boolean }).findable === true && asked !== null && ran.length === 2, 'precheck answers without touching any job')
const pbroken = await (async () => { const res = makeRes(); await createLocationHookHandler({ ...pre, async precheck() { throw new Error('x') } })({ method: 'POST', headers: { authorization: 'Bearer service-key' }, body } as never, res as never); return res })()
assert(pbroken.code === 503, 'precheck failure → 503')
console.log('location-hook api tests: all assertions passed')

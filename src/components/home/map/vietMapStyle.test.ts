import { createVietMapStyleUrl, fetchVietMapStyle } from './vietMapStyle.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const url = createVietMapStyleUrl('key with symbols/+')
assert(url.startsWith('https://maps.vietmap.vn/maps/styles/tm/style.json?'), 'street mode uses the official VIETMAP Vector Street style')
assert(new URL(url).searchParams.get('apikey') === 'key with symbols/+', 'encodes the Tilemap key')
assert(!url.includes('/styles/lm/') && !url.includes('/styles/hm/'), 'street mode does not select Light or Hybrid')

const satellite = createVietMapStyleUrl('k', 'satellite')
assert(satellite.startsWith('https://maps.vietmap.vn/maps/styles/hm/style.json?'), 'satellite mode uses the official VIETMAP Hybrid style')
assert(new URL(satellite).searchParams.get('apikey') === 'k', 'satellite mode keeps the same Tilemap key')

let emptyKeyRejected = false
try {
  createVietMapStyleUrl('  ')
} catch {
  emptyKeyRejected = true
}
assert(emptyKeyRejected, 'rejects an empty Tilemap key before requesting map assets')

// Stalled first request → aborted after its limit → second request succeeds.
{
  let calls = 0
  const fetchImpl = ((_: string, init?: RequestInit) => {
    calls++
    if (calls === 1) return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    return Promise.resolve(new Response(JSON.stringify({ version: 8 }), { status: 200 }))
  }) as typeof fetch
  const style = await fetchVietMapStyle<{ version: number }>('u', { signal: new AbortController().signal, attemptTimeoutsMs: [20, 1000], fetchImpl })
  assert(style.version === 8 && calls === 2, 'a stalled style request is retried once')
}
// Server error is not retried (same answer), outer abort stops immediately.
{
  let calls = 0
  const fetchImpl = (() => { calls++; return Promise.resolve(new Response('no', { status: 401 })) }) as typeof fetch
  let failed = false
  try { await fetchVietMapStyle('u', { signal: new AbortController().signal, fetchImpl }) } catch { failed = true }
  assert(failed && calls === 1, 'HTTP errors fail fast without retry')
  const outer = new AbortController()
  outer.abort()
  let aborted = false
  try { await fetchVietMapStyle('u', { signal: outer.signal, fetchImpl }) } catch { aborted = true }
  assert(aborted && calls === 1, 'unmount (outer abort) does not start requests')
}

console.log('vietMapStyle.test.ts: official Vector Street / Hybrid style assertions passed')

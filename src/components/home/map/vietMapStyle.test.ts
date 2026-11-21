import { createVietMapStyleUrl, fetchVietMapStyle, isVietMapStyle, loadVietMapStyle, STYLE_KINDS, styleCopyPath, stripStyleKey, withStyleKey } from './vietMapStyle.ts'

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

// 우리 쪽 style 사본(Lee 2026-11-21, #950): 열쇠 빼기·채우기는 타일 주소의 apikey 자리에만, sprite·glyphs는 그대로.
{
  const official = {
    version: 8, layers: [{ id: 'bg' }],
    sources: { v: { type: 'vector', tiles: ['https://maps.vietmap.vn/maps/tiles/vlc-1/{z}/{x}/{y}.pbf?apikey=SECRET1'] }, s: { type: 'raster', tiles: ['https://maps.vietmap.vn/maps/tiles/st/{z}/{x}/{y}.png?x=1&apikey=SECRET1'] } },
    sprite: 'https://maps.vietmap.vn/maps/styles/tm/sprite', glyphs: 'https://maps.vietmap.vn/maps/fonts/{fontstack}/{range}.pbf',
  }
  const stripped = stripStyleKey(official)
  assert(!JSON.stringify(stripped).includes('SECRET1'), 'the stored copy has no key')
  assert(stripped.sources.v.tiles[0].endsWith('.pbf?apikey=') && stripped.sources.s.tiles[0].endsWith('?x=1&apikey='), 'the key slot stays, value emptied')
  assert(official.sources.v.tiles[0].endsWith('SECRET1'), 'the official object is not mutated')
  const filled = withStyleKey(stripped, 'K2')
  assert(filled.sources.v.tiles[0].endsWith('.pbf?apikey=K2') && filled.sources.s.tiles[0].endsWith('?x=1&apikey=K2'), 'the key is filled only in the emptied slots')
  assert(filled.sprite === official.sprite && filled.glyphs === official.glyphs, 'sprite and glyph URLs (no key) are unchanged, {fontstack} placeholders kept')
  assert(JSON.stringify(withStyleKey(stripStyleKey(official), 'SECRET1')) === JSON.stringify(official), 'strip → fill gives back the official style')
}
// 사본 먼저 → 사본 없음·형식 오류·멈춤이면 VietMap 원본. 사본이 정상이면 원본을 부르지 않는다.
{
  const good = { version: 8, layers: [{ id: 'bg' }], sources: { v: { tiles: ['https://maps.vietmap.vn/t/{z}/{x}/{y}.pbf?apikey='] } } }
  const run = async (copy: () => Promise<Response>) => {
    const urls: string[] = []
    const fetchImpl = ((u: string) => {
      urls.push(String(u))
      return String(u).startsWith('/vietmap/') ? copy() : Promise.resolve(new Response(JSON.stringify({ ...good, from: 'official' }), { status: 200 }))
    }) as typeof fetch
    const style = await loadVietMapStyle<{ from?: string; sources: { v: { tiles: string[] } } }>('KEY', 'street', { signal: new AbortController().signal, attemptTimeoutsMs: [1000], fetchImpl })
    return { style, urls }
  }
  const ok = await run(() => Promise.resolve(new Response(JSON.stringify(good), { status: 200 })))
  assert(ok.urls.length === 1 && ok.urls[0] === styleCopyPath('street') && ok.style.from === undefined, 'a good copy is used without asking VietMap')
  assert(ok.style.sources.v.tiles[0].endsWith('apikey=KEY'), 'the copy gets the key filled in')
  assert(styleCopyPath('satellite') === '/vietmap/styles/hm.json', 'satellite copy path')
  const missing = await run(() => Promise.resolve(new Response('not found', { status: 404 })))
  assert(missing.style.from === 'official' && missing.urls[1].startsWith('https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=KEY'), 'no copy → VietMap original')
  const broken = await run(() => Promise.resolve(new Response(JSON.stringify({ version: 8 }), { status: 200 })))
  assert(broken.style.from === 'official', 'a copy that is not a usable style → VietMap original')
  const offline = await run(() => Promise.reject(new TypeError('network')))
  assert(offline.style.from === 'official', 'copy request failure → VietMap original')
  const outer = new AbortController(); outer.abort()
  let aborted = false; let calls = 0
  try { await loadVietMapStyle('KEY', 'street', { signal: outer.signal, fetchImpl: (() => { calls++; return Promise.resolve(new Response('{}')) }) as typeof fetch }) } catch { aborted = true }
  assert(aborted && calls === 0, 'unmount (outer abort) requests neither copy nor original')
}
// 저장소 사본: 두 종류 모두 있고, 쓸 수 있는 style이며, 열쇠 값이 들어 있지 않다(빈 apikey= 자리만).
{
  const fsModule = 'node:fs'  // 다른 시험(screenAudit.test.ts)과 같은 방식 — 앱 타입 검사에 node 형식을 넣지 않는다
  const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: URL, enc: string) => string }
  for (const kind of STYLE_KINDS) {
  const text = readFileSync(new URL(`../../../../public${styleCopyPath(kind)}`, import.meta.url), 'utf8')
  assert(isVietMapStyle(JSON.parse(text)), `${kind} copy is a usable style`)
  assert(!/apikey=[^&"]/.test(text), `${kind} copy has no key value`)
  }
}

console.log('vietMapStyle.test.ts: official Vector Street / Hybrid style + copy-first assertions passed')

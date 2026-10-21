// Exercise the actual explorer effect with controlled React effect setup/cleanup and timers.
// No map SDK/network mock: this verifies which camera requests the component schedules.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fitWithNearest } from '../src/lib/fitPins.ts'

for (const name of ['HomeMapExplorer', 'DesktopHomeMapExplorer']) {
  const source = readFileSync(new URL(`../src/components/home/${name}.tsx`, import.meta.url), 'utf8')
  const body = source.match(/useEffect\(\(\) => \{\n(    if \(!userPointKey[\s\S]*?)\n  \}, \[userPointKey[^\]]*\]\)/)?.[1]
  assert.ok(body, `${name}: location camera effect found`)
  const makeEffect = new Function('state', `with (state) { return () => { ${body}
 }; }`)
  const pins = [{ lat: 21.15684391, lng: 106.127527742 }, { lat: 21.1965731, lng: 105.9932563 }]
  const state = {
    userPointKey: '21.1,106.07', origin: { kind: 'user', point: { lat: 21.1, lng: 106.07 } },
    hasPins: false, markersRef: { current: [] as typeof pins }, fittedWithPins: { current: null as string | null },
    fitWithNearest, requests: [] as ReturnType<typeof fitWithNearest>[], timers: new Map<number, () => void>(),
    setCameraRequest(v: ReturnType<typeof fitWithNearest>) { state.requests.push(v) },
    setTimeout(fn: () => void) { const id = ++nextId; state.timers.set(id, fn); return id },
    clearTimeout(id: number) { state.timers.delete(id) },
  }
  let nextId = 0
  const effect = makeEffect(state)
  const flush = () => { for (const [id, fn] of state.timers) { state.timers.delete(id); fn() } }
  effect(); flush()
  assert.deepEqual(state.requests.at(-1), fitWithNearest(state.origin.point, []), `${name}: location first`)
  state.hasPins = true; state.markersRef.current = pins
  effect(); flush()
  assert.deepEqual(state.requests.at(-1), fitWithNearest(state.origin.point, pins), `${name}: late pins trigger refit`)
  const count = state.requests.length
  effect(); flush()
  assert.equal(state.requests.length, count, `${name}: settled fit does not reset user pan`)
  // React StrictMode cancels the first effect before replaying it. An unexecuted fit must not count as done.
  state.fittedWithPins.current = null; state.requests.length = 0
  const cleanup = effect(); cleanup?.()
  effect(); flush()
  assert.equal(state.requests.length, 1, `${name}: cancelled fit must be retried`)
}
console.log('map fit effect: late pins, settled pan and StrictMode cancellation passed')

import { startVisibleTimeout, type VisibilityEnv } from './visibleTimeout.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

function fakeEnv(visible: boolean) {
  let now = 0
  let id = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const listeners = new Set<() => void>()
  const env: VisibilityEnv = {
    isVisible: () => visible,
    onVisibilityChange: (l) => { listeners.add(l); return () => listeners.delete(l) },
    setTimeout: (fn, ms) => { timers.set(++id, { at: now + ms, fn }); return id },
    clearTimeout: (t) => { timers.delete(t) },
    now: () => now,
  }
  const advance = (ms: number) => {
    now += ms
    for (const [t, v] of [...timers]) if (v.at <= now) { timers.delete(t); v.fn() }
  }
  const setVisible = (v: boolean) => { visible = v; listeners.forEach((l) => l()) }
  return { env, advance, setVisible, listeners }
}

{
  const f = fakeEnv(true)
  let fired = 0
  startVisibleTimeout(12_000, () => fired++, f.env)
  f.advance(11_999)
  assert(fired === 0, 'visible: not before 12 s')
  f.advance(1)
  assert(fired === 1, 'visible: fires at 12 s (unchanged behavior)')
}
{
  const f = fakeEnv(false)
  let fired = 0
  startVisibleTimeout(12_000, () => fired++, f.env)
  f.advance(60_000)
  assert(fired === 0, 'opened in a background tab: never falls back while hidden')
  f.setVisible(true)
  f.advance(11_000)
  assert(fired === 0, 'clock starts only when the tab becomes visible')
  f.advance(1_000)
  assert(fired === 1, 'then fires after 12 visible seconds')
}
{
  const f = fakeEnv(true)
  let fired = 0
  startVisibleTimeout(12_000, () => fired++, f.env)
  f.advance(5_000)
  f.setVisible(false)
  f.advance(30_000)
  f.setVisible(true)
  f.advance(6_999)
  assert(fired === 0, 'hidden time is not counted (5 s + 6.999 s visible)')
  f.advance(1)
  assert(fired === 1, 'fires after 12 s of total visible time')
}
{
  const f = fakeEnv(true)
  let fired = 0
  const cancel = startVisibleTimeout(12_000, () => fired++, f.env)
  cancel()
  f.advance(20_000)
  f.setVisible(false); f.setVisible(true); f.advance(20_000)
  assert(fired === 0 && f.listeners.size === 0, 'cancel stops the timer and the visibility listener')
}

console.log('visibleTimeout.test.ts: hidden-tab map init timeout assertions passed')

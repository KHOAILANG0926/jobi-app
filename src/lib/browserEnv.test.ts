import { emitEvent, onEvent } from './eventBus.ts'
import { kvLocal, kvSession } from './kvStore.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }

// 가짜 window(이벤트 대상 + 저장소)에 브라우저 어댑터를 끼워, 예전 window 이벤트·localStorage와 같게 동작하는지 본다.
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }
const win = Object.assign(new EventTarget(), { localStorage: mem(), sessionStorage: mem() })
;(globalThis as unknown as { window: unknown }).window = win
const { installBrowserEnv } = await import('./browserEnv.ts')
installBrowserEnv()

// 저장소: 어댑터를 거친 쓰기가 window.localStorage에 그대로 들어가고, 거꾸로도 읽힌다
kvLocal.set('k', 'v'); assert(win.localStorage.getItem('k') === 'v', 'kvLocal이 window.localStorage에 쓴다')
win.localStorage.setItem('z', '9'); assert(kvLocal.get('z') === '9', 'window.localStorage에 직접 쓴 값을 kvLocal이 읽는다')
kvSession.set('s', '1'); assert(win.sessionStorage.getItem('s') === '1' && win.localStorage.getItem('s') === null, 'kvSession은 sessionStorage')
kvLocal.remove('k'); assert(win.localStorage.getItem('k') === null, 'remove')

// 이벤트: emit이 예전과 같은 이름('vgb:이름')의 window 이벤트로 나가고, 예전식 window 이벤트도 onEvent가 받는다
const state = { legacy: 0, bus: 0 }
const c = () => ({ ...state })
win.addEventListener('vgb:applications', () => { state.legacy++ })
const off = onEvent('applications', () => { state.bus++ })
emitEvent('applications')
assert(c().legacy === 1 && c().bus === 1, 'emit → 예전 listener와 onEvent 둘 다 받음 (' + JSON.stringify(c()) + ')')
win.dispatchEvent(new CustomEvent('vgb:applications'))
assert(c().legacy === 2 && c().bus === 2, '예전식 dispatchEvent → onEvent도 받음 (' + JSON.stringify(c()) + ')')
off(); emitEvent('applications')
assert(c().legacy === 3 && c().bus === 2, 'off 한 뒤에는 onEvent만 멈춤 (' + JSON.stringify(c()) + ')')
console.log('browserEnv: storage bridge + event name compatibility passed')

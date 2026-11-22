import {
  PRIMARY_MAP_INIT_TIMEOUT_MS,
  createHomeMapProviderState,
  homeMapProviderReducer,
} from './homeMapProviderState.ts'
import { HOME_STYLE_ATTEMPTS_MS, STYLE_ATTEMPTS_MS } from './vietMapStyle.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

assert(PRIMARY_MAP_INIT_TIMEOUT_MS === 12_000, 'primary provider initialization timeout is exactly 12 seconds')
// MAP-1(#946, 2026-11-21): 메인 지도 스타일 재시도는 12초 초기화 제한 안에 끝나야 한다(넘으면 재시도 전에 예비 지도로 넘어감). 상세·관리자는 긴 값.
assert(HOME_STYLE_ATTEMPTS_MS.reduce((a, b) => a + b, 0) < PRIMARY_MAP_INIT_TIMEOUT_MS, 'home style attempts fit inside the 12s init limit')
assert(STYLE_ATTEMPTS_MS.join() === '15000,20000', 'detail/admin style attempts follow measured VietMap latency')

const withoutKey = createHomeMapProviderState(false)
assert(withoutKey.provider === 'geoapify', 'no key selects Geoapify immediately')

const withKey = createHomeMapProviderState(true)
assert(withKey.provider === 'vietmap-loading', 'VIETMAP key selects VIETMAP loading state')
assert(Object.keys(withKey).sort().join(',') === 'failureReason,generation,lastViewport,provider', 'state contains no stale map props')
assert(!('origin' in withKey) && !('radiusKm' in withKey) && !('markers' in withKey) && !('selectedId' in withKey) && !('recenterRequest' in withKey), 'search props remain outside reducer state')

const ready = homeMapProviderReducer(withKey, { type: 'VIETMAP_READY', generation: withKey.generation })
assert(ready.provider === 'vietmap-ready', 'ready before timeout keeps VIETMAP active')

for (const [event, reason] of [
  [{ type: 'VIETMAP_FAILED', generation: withKey.generation, reason: 'loader-error' }, 'loader-error'],
  [{ type: 'VIETMAP_FAILED', generation: withKey.generation, reason: 'initialization-error' }, 'initialization-error'],
  [{ type: 'VIETMAP_FAILED', generation: withKey.generation, reason: 'auth-failure' }, 'auth-failure'],
  [{ type: 'VIETMAP_TIMEOUT', generation: withKey.generation }, 'timeout'],
] as const) {
  const failed = homeMapProviderReducer(withKey, event)
  assert(failed.provider === 'geoapify' && failed.failureReason === reason, `${reason} falls back to Geoapify`)
  const duplicate = homeMapProviderReducer(failed, event)
  assert(duplicate === failed, `${reason} duplicate failure is idempotent`)
  const lateReady = homeMapProviderReducer(failed, { type: 'VIETMAP_READY', generation: withKey.generation })
  assert(lateReady === failed, `${reason} ignores a late ready event`)
}

const viewport = { center: { lat: 21.1861, lng: 106.0763 }, zoom: 12.75 }
const withViewport = homeMapProviderReducer(withKey, { type: 'VIEWPORT_CHANGED', generation: withKey.generation, viewport })
const failedWithViewport = homeMapProviderReducer(withViewport, { type: 'VIETMAP_FAILED', generation: withKey.generation, reason: 'auth-failure' })
assert(failedWithViewport.lastViewport === viewport, 'saved viewport survives fallback')

const nextGeneration = homeMapProviderReducer(failedWithViewport, { type: 'RESET_GENERATION', hasVietMapKey: true })
assert(nextGeneration.generation === withKey.generation + 1 && nextGeneration.provider === 'vietmap-loading', 'reset starts a new guarded generation')
const staleFailure = homeMapProviderReducer(nextGeneration, { type: 'VIETMAP_FAILED', generation: withKey.generation, reason: 'loader-error' })
assert(staleFailure === nextGeneration, 'events from an older generation are ignored')

console.log('homeMapProviderState.test.ts: provider transition assertions passed')

import {
  GOOGLE_MAP_INIT_TIMEOUT_MS,
  createHomeMapProviderState,
  homeMapProviderReducer,
} from './homeMapProviderState.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

assert(GOOGLE_MAP_INIT_TIMEOUT_MS === 12_000, 'Google initialization timeout is exactly 12 seconds')

const withoutKey = createHomeMapProviderState(false)
assert(withoutKey.provider === 'geoapify', 'no key selects Geoapify immediately')

const withKey = createHomeMapProviderState(true)
assert(withKey.provider === 'google-loading', 'key selects Google loading state')
assert(Object.keys(withKey).sort().join(',') === 'failureReason,generation,lastViewport,provider', 'state contains no stale map props')
assert(!('origin' in withKey) && !('radiusKm' in withKey) && !('markers' in withKey) && !('selectedId' in withKey) && !('recenterRequest' in withKey), 'search props remain outside reducer state')

const ready = homeMapProviderReducer(withKey, { type: 'GOOGLE_READY', generation: withKey.generation })
assert(ready.provider === 'google-ready', 'ready before timeout keeps Google active')

for (const [event, reason] of [
  [{ type: 'GOOGLE_FAILED', generation: withKey.generation, reason: 'loader-error' }, 'loader-error'],
  [{ type: 'GOOGLE_FAILED', generation: withKey.generation, reason: 'initialization-error' }, 'initialization-error'],
  [{ type: 'GOOGLE_FAILED', generation: withKey.generation, reason: 'auth-failure' }, 'auth-failure'],
  [{ type: 'GOOGLE_TIMEOUT', generation: withKey.generation }, 'timeout'],
] as const) {
  const failed = homeMapProviderReducer(withKey, event)
  assert(failed.provider === 'geoapify' && failed.failureReason === reason, `${reason} falls back to Geoapify`)
  const duplicate = homeMapProviderReducer(failed, event)
  assert(duplicate === failed, `${reason} duplicate failure is idempotent`)
  const lateReady = homeMapProviderReducer(failed, { type: 'GOOGLE_READY', generation: withKey.generation })
  assert(lateReady === failed, `${reason} ignores a late ready event`)
}

const viewport = { center: { lat: 21.1861, lng: 106.0763 }, zoom: 12.75 }
const withViewport = homeMapProviderReducer(withKey, { type: 'VIEWPORT_CHANGED', generation: withKey.generation, viewport })
const failedWithViewport = homeMapProviderReducer(withViewport, { type: 'GOOGLE_FAILED', generation: withKey.generation, reason: 'auth-failure' })
assert(failedWithViewport.lastViewport === viewport, 'saved viewport survives fallback')

const nextGeneration = homeMapProviderReducer(failedWithViewport, { type: 'RESET_GENERATION', hasGoogleKey: true })
assert(nextGeneration.generation === withKey.generation + 1 && nextGeneration.provider === 'google-loading', 'reset starts a new guarded generation')
const staleFailure = homeMapProviderReducer(nextGeneration, { type: 'GOOGLE_FAILED', generation: withKey.generation, reason: 'loader-error' })
assert(staleFailure === nextGeneration, 'events from an older generation are ignored')

console.log('homeMapProviderState.test.ts: provider transition assertions passed')

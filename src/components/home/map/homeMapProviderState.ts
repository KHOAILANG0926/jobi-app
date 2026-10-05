import type { HomeMapFailureReason, HomeMapViewport } from './HomeMapTypes'

export const PRIMARY_MAP_INIT_TIMEOUT_MS = 12_000

export type HomeMapProvider = 'geoapify' | 'vietmap-loading' | 'vietmap-ready'

export interface HomeMapProviderState {
  provider: HomeMapProvider
  generation: number
  lastViewport: HomeMapViewport | null
  failureReason: HomeMapFailureReason | null
}

export type HomeMapProviderEvent =
  | { type: 'VIETMAP_READY'; generation: number }
  | { type: 'VIETMAP_FAILED'; generation: number; reason: HomeMapFailureReason }
  | { type: 'VIETMAP_TIMEOUT'; generation: number }
  | { type: 'VIEWPORT_CHANGED'; generation: number; viewport: HomeMapViewport }
  | { type: 'RESET_GENERATION'; hasVietMapKey: boolean }

export function createHomeMapProviderState(hasVietMapKey: boolean): HomeMapProviderState {
  return {
    provider: hasVietMapKey ? 'vietmap-loading' : 'geoapify',
    generation: 1,
    lastViewport: null,
    failureReason: null,
  }
}

export function homeMapProviderReducer(
  state: HomeMapProviderState,
  event: HomeMapProviderEvent,
): HomeMapProviderState {
  if (event.type === 'RESET_GENERATION') {
    return {
      provider: event.hasVietMapKey ? 'vietmap-loading' : 'geoapify',
      generation: state.generation + 1,
      lastViewport: state.lastViewport,
      failureReason: null,
    }
  }
  if (event.generation !== state.generation) return state

  switch (event.type) {
    case 'VIEWPORT_CHANGED':
      return { ...state, lastViewport: event.viewport }
    case 'VIETMAP_READY':
      return state.provider === 'vietmap-loading' ? { ...state, provider: 'vietmap-ready' } : state
    case 'VIETMAP_TIMEOUT':
      return state.provider === 'vietmap-loading'
        ? { ...state, provider: 'geoapify', failureReason: 'timeout' }
        : state
    case 'VIETMAP_FAILED':
      return state.provider === 'vietmap-loading' || state.provider === 'vietmap-ready'
        ? { ...state, provider: 'geoapify', failureReason: event.reason }
        : state
  }
}

import type { HomeMapFailureReason, HomeMapViewport } from './HomeMapTypes'

export const PRIMARY_MAP_INIT_TIMEOUT_MS = 12_000

export type HomeMapProvider = 'geoapify' | 'tomtom-loading' | 'tomtom-ready'

export interface HomeMapProviderState {
  provider: HomeMapProvider
  generation: number
  lastViewport: HomeMapViewport | null
  failureReason: HomeMapFailureReason | null
}

export type HomeMapProviderEvent =
  | { type: 'TOMTOM_READY'; generation: number }
  | { type: 'TOMTOM_FAILED'; generation: number; reason: HomeMapFailureReason }
  | { type: 'TOMTOM_TIMEOUT'; generation: number }
  | { type: 'VIEWPORT_CHANGED'; generation: number; viewport: HomeMapViewport }
  | { type: 'RESET_GENERATION'; hasTomTomKey: boolean }

export function createHomeMapProviderState(hasTomTomKey: boolean): HomeMapProviderState {
  return {
    provider: hasTomTomKey ? 'tomtom-loading' : 'geoapify',
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
      provider: event.hasTomTomKey ? 'tomtom-loading' : 'geoapify',
      generation: state.generation + 1,
      lastViewport: state.lastViewport,
      failureReason: null,
    }
  }
  if (event.generation !== state.generation) return state

  switch (event.type) {
    case 'VIEWPORT_CHANGED':
      return { ...state, lastViewport: event.viewport }
    case 'TOMTOM_READY':
      return state.provider === 'tomtom-loading' ? { ...state, provider: 'tomtom-ready' } : state
    case 'TOMTOM_TIMEOUT':
      return state.provider === 'tomtom-loading'
        ? { ...state, provider: 'geoapify', failureReason: 'timeout' }
        : state
    case 'TOMTOM_FAILED':
      return state.provider === 'tomtom-loading' || state.provider === 'tomtom-ready'
        ? { ...state, provider: 'geoapify', failureReason: event.reason }
        : state
  }
}

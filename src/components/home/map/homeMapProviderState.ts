import type { HomeMapFailureReason, HomeMapViewport } from './HomeMapTypes'

export const GOOGLE_MAP_INIT_TIMEOUT_MS = 12_000

export type HomeMapProvider = 'geoapify' | 'google-loading' | 'google-ready'

export interface HomeMapProviderState {
  provider: HomeMapProvider
  generation: number
  lastViewport: HomeMapViewport | null
  failureReason: HomeMapFailureReason | null
}

export type HomeMapProviderEvent =
  | { type: 'GOOGLE_READY'; generation: number }
  | { type: 'GOOGLE_FAILED'; generation: number; reason: HomeMapFailureReason }
  | { type: 'GOOGLE_TIMEOUT'; generation: number }
  | { type: 'VIEWPORT_CHANGED'; generation: number; viewport: HomeMapViewport }
  | { type: 'RESET_GENERATION'; hasGoogleKey: boolean }

export function createHomeMapProviderState(hasGoogleKey: boolean): HomeMapProviderState {
  return {
    provider: hasGoogleKey ? 'google-loading' : 'geoapify',
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
      provider: event.hasGoogleKey ? 'google-loading' : 'geoapify',
      generation: state.generation + 1,
      lastViewport: state.lastViewport,
      failureReason: null,
    }
  }
  if (event.generation !== state.generation) return state

  switch (event.type) {
    case 'VIEWPORT_CHANGED':
      return { ...state, lastViewport: event.viewport }
    case 'GOOGLE_READY':
      return state.provider === 'google-loading' ? { ...state, provider: 'google-ready' } : state
    case 'GOOGLE_TIMEOUT':
      return state.provider === 'google-loading'
        ? { ...state, provider: 'geoapify', failureReason: 'timeout' }
        : state
    case 'GOOGLE_FAILED':
      return state.provider === 'google-loading' || state.provider === 'google-ready'
        ? { ...state, provider: 'geoapify', failureReason: event.reason }
        : state
  }
}

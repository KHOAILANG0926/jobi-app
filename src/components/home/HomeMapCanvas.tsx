// 메인 지도 provider 선택, Google 초기화 timeout, Geoapify fallback과 viewport 승계를 관리한다.
import { lazy, useEffect, useReducer } from 'react'
import type { HomeMapMarker, HomeMapProviderProps } from './map/HomeMapTypes'
import {
  GOOGLE_MAP_INIT_TIMEOUT_MS,
  createHomeMapProviderState,
  homeMapProviderReducer,
} from './map/homeMapProviderState'

export type { HomeMapMarker }

type Props = Pick<
  HomeMapProviderProps,
  'origin' | 'originIsUser' | 'radiusKm' | 'recenterRequest' | 'markers' | 'selectedId' | 'onSelect'
>

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? ''
const GoogleMapCanvas = GOOGLE_MAPS_API_KEY ? lazy(() => import('./map/GoogleMapCanvas')) : null
const GeoapifyMapCanvas = lazy(() => import('./map/GeoapifyMapCanvas'))

export default function HomeMapCanvas(props: Props) {
  const [state, dispatch] = useReducer(
    homeMapProviderReducer,
    GOOGLE_MAPS_API_KEY.length > 0,
    createHomeMapProviderState,
  )
  const generation = state.generation

  useEffect(() => {
    if (state.provider !== 'google-loading') return
    const timeout = window.setTimeout(() => {
      dispatch({ type: 'GOOGLE_TIMEOUT', generation })
    }, GOOGLE_MAP_INIT_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [generation, state.provider])

  const sharedProps = {
    ...props,
    onViewportChange: (viewport: Parameters<HomeMapProviderProps['onViewportChange']>[0]) => {
      dispatch({ type: 'VIEWPORT_CHANGED', generation, viewport })
    },
  }

  if (state.provider === 'geoapify' || !GoogleMapCanvas) {
    return (
      <GeoapifyMapCanvas
        {...sharedProps}
        initialViewport={state.lastViewport ?? undefined}
        onReady={() => undefined}
        onFailure={() => undefined}
      />
    )
  }

  return (
    <GoogleMapCanvas
      {...sharedProps}
      onReady={() => dispatch({ type: 'GOOGLE_READY', generation })}
      onFailure={(reason) => dispatch({ type: 'GOOGLE_FAILED', generation, reason })}
    />
  )
}

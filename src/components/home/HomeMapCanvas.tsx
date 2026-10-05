// 메인 지도 provider 선택, VIETMAP 초기화 timeout, Geoapify fallback과 viewport 승계를 관리한다.
import { lazy, useEffect, useReducer } from 'react'
import type { HomeMapMarker, HomeMapProviderProps } from './map/HomeMapTypes'
import {
  PRIMARY_MAP_INIT_TIMEOUT_MS,
  createHomeMapProviderState,
  homeMapProviderReducer,
} from './map/homeMapProviderState'

export type { HomeMapMarker }

type Props = Pick<
  HomeMapProviderProps,
  'origin' | 'originIsUser' | 'radiusKm' | 'recenterRequest' | 'markers' | 'selectedId' | 'onSelect'
>

const VIETMAP_TILEMAP_KEY = (import.meta.env.VITE_VIETMAP_TILEMAP_KEY as string | undefined)?.trim() ?? ''
const VietMapMapCanvas = VIETMAP_TILEMAP_KEY ? lazy(() => import('./map/VietMapMapCanvas')) : null
const GeoapifyMapCanvas = lazy(() => import('./map/GeoapifyMapCanvas'))

export default function HomeMapCanvas(props: Props) {
  const [state, dispatch] = useReducer(
    homeMapProviderReducer,
    VIETMAP_TILEMAP_KEY.length > 0,
    createHomeMapProviderState,
  )
  const generation = state.generation

  useEffect(() => {
    if (state.provider !== 'vietmap-loading') return
    const timeout = window.setTimeout(() => {
      dispatch({ type: 'VIETMAP_TIMEOUT', generation })
    }, PRIMARY_MAP_INIT_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [generation, state.provider])

  const sharedProps = {
    ...props,
    onViewportChange: (viewport: Parameters<HomeMapProviderProps['onViewportChange']>[0]) => {
      dispatch({ type: 'VIEWPORT_CHANGED', generation, viewport })
    },
  }

  if (state.provider === 'geoapify' || !VietMapMapCanvas) {
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
    <VietMapMapCanvas
      {...sharedProps}
      onReady={() => dispatch({ type: 'VIETMAP_READY', generation })}
      onFailure={(reason) => dispatch({ type: 'VIETMAP_FAILED', generation, reason })}
    />
  )
}

// 메인 지도 provider 선택, VIETMAP 초기화 timeout, Geoapify fallback과 viewport 승계를 관리한다.
import { lazy, useEffect, useReducer } from 'react'
import type { HomeMapMarker, HomeMapProviderProps } from './map/HomeMapTypes'
import {
  PRIMARY_MAP_INIT_TIMEOUT_MS,
  createHomeMapProviderState,
  homeMapProviderReducer,
} from './map/homeMapProviderState'
import { startVisibleTimeout } from './map/visibleTimeout'

export type { HomeMapMarker }

type Props = Pick<
  HomeMapProviderProps,
  | 'origin' | 'originIsUser' | 'radiusKm' | 'recenterRequest' | 'markers' | 'selectedId' | 'onSelect' | 'onNearbyChange'
  | 'mapMode' | 'onMapModeChange' | 'pickedPlace' | 'onPlacePick' | 'placeZoomRequest'
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

  // 숨겨진 탭에서는 지도 SDK의 rAF가 멈춰 초기화가 진행되지 않는다 → 보이는 시간만 센다.
  useEffect(() => {
    if (state.provider !== 'vietmap-loading') return
    return startVisibleTimeout(PRIMARY_MAP_INIT_TIMEOUT_MS, () => {
      dispatch({ type: 'VIETMAP_TIMEOUT', generation })
    })
  }, [generation, state.provider])

  // Geoapify fallback에는 POI 조회 기능이 없다 → 주변시설은 "지원 안 됨"으로 알린다(가짜 0 아님).
  const fallbackActive = state.provider === 'geoapify' || !VietMapMapCanvas
  const { onNearbyChange, onPlacePick, selectedId } = props
  useEffect(() => {
    if (fallbackActive) onNearbyChange?.(selectedId ? { status: 'unavailable', jobId: selectedId } : { status: 'idle' })
  }, [fallbackActive, onNearbyChange, selectedId])
  // 건물/시설 클릭 상세는 VietMap 벡터 데이터가 필요하다 → fallback 전환 시 닫는다.
  useEffect(() => { if (fallbackActive) onPlacePick?.(null) }, [fallbackActive, onPlacePick])

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

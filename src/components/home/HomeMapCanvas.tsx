// 메인 지도 provider 경계. Google coordinator가 연결되기 전에는 Geoapify를 그대로 사용한다.
import GeoapifyMapCanvas from './map/GeoapifyMapCanvas'
import type { HomeMapMarker, HomeMapProviderProps } from './map/HomeMapTypes'

export type { HomeMapMarker }

type Props = Pick<
  HomeMapProviderProps,
  'origin' | 'originIsUser' | 'radiusKm' | 'recenterRequest' | 'markers' | 'selectedId' | 'onSelect'
>

const noop = () => undefined

export default function HomeMapCanvas(props: Props) {
  return (
    <GeoapifyMapCanvas
      {...props}
      onViewportChange={noop}
      onReady={noop}
      onFailure={noop}
    />
  )
}

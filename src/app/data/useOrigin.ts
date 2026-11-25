import { useCallback, useState } from 'react'

export type OriginState = { status: 'idle' | 'loading' | 'denied' | 'unsupported'; point?: undefined } | { status: 'ready'; point: { lat: number; lng: number } }

/** 현재 위치(사용자가 버튼을 눌렀을 때만 요청). 기준 위치는 "검색 출발점"일 뿐 공고 좌표가 아니다(lib/homeMapFilters 원칙). */
export function useOrigin(): { origin: OriginState; request: () => void } {
  const [origin, setOrigin] = useState<OriginState>({ status: 'idle' })
  const request = useCallback(() => {
    if (!('geolocation' in navigator)) { setOrigin({ status: 'unsupported' }); return }
    setOrigin({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigin({ status: 'ready', point: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => setOrigin({ status: 'denied' }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }, [])
  return { origin, request }
}

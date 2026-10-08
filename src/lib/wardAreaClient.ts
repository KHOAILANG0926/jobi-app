import { useEffect, useState } from 'react'
import { WARD_KEY_PATTERN, type WardUnit } from './wardArea'

// 공개 조회: /api/ward-area가 비공개 저장소 캐시에서 xã/phường 한 곳의 중심 좌표만 돌려준다(VietMap 호출 없음).
export interface WardCenter { lat: number; lng: number }

const memo = new Map<string, Promise<WardCenter | null>>()

export function fetchWardCenter(key: string): Promise<WardCenter | null> {
  if (!WARD_KEY_PATTERN.test(key)) return Promise.resolve(null)
  const known = memo.get(key)
  if (known) return known
  const request = fetch(`/api/ward-area?key=${encodeURIComponent(key)}`)
    .then(async (res) => {
      if (!res.ok) return null
      const json = (await res.json().catch(() => null)) as { found?: boolean; lat?: unknown; lng?: unknown } | null
      return json?.found && typeof json.lat === 'number' && typeof json.lng === 'number' ? { lat: json.lat, lng: json.lng } : null
    })
    .catch(() => null)
  memo.set(key, request)
  // 일시적인 실패(null)는 다음 방문 때 다시 시도하도록 기억하지 않는다.
  void request.then((center) => { if (!center) memo.delete(key) })
  return request
}

/** 브라우저에서만 조회한다(SSR은 항상 null). unit이 없으면 부르지 않는다. */
export function useWardCenter(unit: WardUnit | null): WardCenter | null {
  const key = unit?.key ?? null
  const [state, setState] = useState<{ key: string; center: WardCenter } | null>(null)
  useEffect(() => {
    if (!key) return
    let alive = true
    void fetchWardCenter(key).then((center) => { if (alive && center) setState({ key, center }) })
    return () => { alive = false }
  }, [key])
  return state && state.key === key ? state.center : null
}

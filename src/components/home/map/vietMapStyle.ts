// VietMap 공식 style 주소. 일반지도는 Vector Street(tm), 위성은 공식 Hybrid(hm:
// 위성 raster `satellite-tile` + 도로·POI 벡터 라벨). 2026-10-05 Hybrid 지원 확인.
const VIETMAP_STYLE_BASE = 'https://maps.vietmap.vn/maps/styles'

export type VietMapStyleKind = 'street' | 'satellite'

const STYLE_PATH: Readonly<Record<VietMapStyleKind, string>> = {
  street: 'tm',
  satellite: 'hm',
}

/**
 * VietMap style JSON 요청. 평소 60~300 ms지만 간헐적으로 응답이 10초 넘게 멈춘 사례가
 * 있었다(2026-10-06 Production 실측 12.3초 → 초기화 timeout으로 예비 지도 전환).
 * 시도마다 제한 시간을 두고, 멈추면 새 요청으로 한 번 더 시도한다.
 */
export async function fetchVietMapStyle<T>(
  url: string,
  options: { signal: AbortSignal; attemptTimeoutsMs?: number[]; fetchImpl?: typeof fetch },
): Promise<T> {
  const { signal, attemptTimeoutsMs = [5_000, 6_000], fetchImpl = fetch } = options
  let lastError: unknown = null
  for (const limit of attemptTimeoutsMs) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError')
    const attempt = new AbortController()
    const stop = () => attempt.abort()
    signal.addEventListener('abort', stop, { once: true })
    const timer = setTimeout(stop, limit)
    try {
      const res = await fetchImpl(url, { signal: attempt.signal })
      if (!res.ok) throw new Error(`style ${res.status}`)
      return (await res.json()) as T
    } catch (error) {
      lastError = error
      if (signal.aborted) throw error
      // 4xx 등 서버가 응답한 실패는 재시도해도 같으므로 바로 실패로 넘긴다.
      if (error instanceof Error && /^style \d+$/.test(error.message)) throw error
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', stop)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('style request timed out')
}

export function createVietMapStyleUrl(apiKey: string, kind: VietMapStyleKind = 'street'): string {
  const key = apiKey.trim()
  if (!key) throw new Error('VIETMAP Tilemap key is required')
  return `${VIETMAP_STYLE_BASE}/${STYLE_PATH[kind]}/style.json?${new URLSearchParams({ apikey: key }).toString()}`
}

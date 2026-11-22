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
 * 2026-11-21 MAP-1(#946): 같은 주소를 연달아 12번 물으면 3번이 11~12초, 1번은 20초 넘게 걸렸다(다른 VietMap 파일·운영 사이트는 1초 안).
 * 예전 제한(5초·6초)은 두 번 모두 넘겨 지도가 '불러오기 실패'로 굳었다(운영 지도 검사 실패와 같은 모양). 실측에 맞춰 15초·20초로 늘린다.
 * 단 메인 지도는 12초 초기화 제한(PRIMARY_MAP_INIT_TIMEOUT_MS) 뒤 예비 지도로 넘어가므로, 재시도가 그 안에 들어가게 예전 값(5초·6초)을 그대로 쓴다
 * (HOME_STYLE_ATTEMPTS_MS — 합이 12초보다 작다는 것은 homeMapProviderState.test.ts가 확인). 긴 값은 예비 지도가 없는 상세·관리자 지도에만.
 */
export const STYLE_ATTEMPTS_MS = [15_000, 20_000]
export const HOME_STYLE_ATTEMPTS_MS = [5_000, 6_000]
export async function fetchVietMapStyle<T>(
  url: string,
  options: { signal: AbortSignal; attemptTimeoutsMs?: number[]; fetchImpl?: typeof fetch },
): Promise<T> {
  const { signal, attemptTimeoutsMs = STYLE_ATTEMPTS_MS, fetchImpl = fetch } = options
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

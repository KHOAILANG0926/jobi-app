/**
 * Geoapify 지오코딩 — 기존에 JobLocationMap.tsx가 지도 타일용으로 쓰던
 * VITE_GEOAPIFY_API_KEY를 재사용한다(새 API 키/공급자 도입 없음). 이
 * 프로젝트에 지금까지 런타임 지오코딩(좌표↔주소 변환)이 전혀 없었고
 * (크롤러가 오프라인으로 미리 계산해 DB에 저장하는 값만 소비), 이 파일이
 * 그 첫 도입이다 — Home.tsx의 "Gần tôi"(GPS로 좌표를 받아도 사람이 읽을
 * 주소를 안 보여주던 문제, 주소 직접 검색 기능 부재) 두 가지를 위해 필요.
 */

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined

interface GeoapifyResult {
  formatted?: string
  suburb?: string
  district?: string
  county?: string
  city?: string
  state?: string
  lat?: number
  lon?: number
}

/** 좌표 → 사람이 읽을 수 있는 주소(구/현 + 성/시 정도로 짧게). 실패하면
 *  null — 호출 쪽에서 "주소 없이도" 기존 동작(좌표만 사용)을 그대로
 *  유지해야 한다(가짜 주소를 보여주지 않는다). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GEOAPIFY_KEY) return null
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_KEY}&format=json&lang=vi`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: GeoapifyResult[] }
    const r = data.results?.[0]
    if (!r) return null
    const parts = [r.suburb || r.district || r.county, r.city || r.state].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : (r.formatted ?? null)
  } catch {
    return null
  }
}

export interface AddressSuggestion {
  label: string
  lat: number
  lng: number
}

/** 주소/지역 텍스트 → 좌표 후보 목록(최대 5개, 베트남 내로 한정). 사용자가
 *  직접 입력한 주소로 "내 주변" 검색을 대신할 때 쓴다. */
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (!GEOAPIFY_KEY || !q) return []
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&apiKey=${GEOAPIFY_KEY}&filter=countrycode:vn&format=json&lang=vi&limit=5`,
    )
    if (!res.ok) return []
    const data = (await res.json()) as { results?: GeoapifyResult[] }
    return (data.results ?? [])
      .filter((r): r is GeoapifyResult & { lat: number; lon: number } => typeof r.lat === 'number' && typeof r.lon === 'number')
      .map((r) => ({ label: r.formatted ?? `${r.lat}, ${r.lon}`, lat: r.lat, lng: r.lon }))
  } catch {
    return []
  }
}

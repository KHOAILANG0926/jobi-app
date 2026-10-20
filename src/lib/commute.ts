// 오토바이 출퇴근 시간(대략값) — 2026-10-20 Lee 결정("오토바이로 몇 분").
// 지도 API를 부르지 않는다(비용 없음): 직선거리 × 도로 굴곡 1.4 ÷ 오토바이 평균 30km/h.
// 정확한 근무지(확인 좌표·공단 입구)에만 쓴다. 동 중심 같은 대략 위치는 오차(3.5~7.6km)가 커서 시간을 붙이지 않는다.
export const ROAD_FACTOR = 1.4
export const MOTORBIKE_KMH = 30

export function motorbikeMinutes(straightKm: number): number | null {
  if (!Number.isFinite(straightKm) || straightKm < 0) return null
  const raw = (straightKm * ROAD_FACTOR) / MOTORBIKE_KMH * 60
  if (raw < 1) return 1
  return raw < 10 ? Math.round(raw) : Math.round(raw / 5) * 5
}

/** "Xe máy khoảng 12 phút" / "Xe máy hơn 1 giờ". 계산할 수 없으면 null. */
export function motorbikeLabel(straightKm: number): string | null {
  const m = motorbikeMinutes(straightKm)
  if (m == null) return null
  if (m > 60) return 'Xe máy hơn 1 giờ'
  return `Xe máy khoảng ${m} phút`
}

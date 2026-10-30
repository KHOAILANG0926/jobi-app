// Lee 2026-10-30: 지도 핀 = 📍 압정 모양(빨간 동그라미 머리 + 검은 바늘, 바늘 끝이 위치). 메인·상세 지도, PC·휴대폰 공통.
// 대략 위치(정확하지 않은 점)는 머리를 연하게+점선 테두리로 구분한다(기존 정확도 표시 유지).
export function pushPinClass(kinds: readonly (string | undefined)[], selected = false): string {
  const representative = kinds.some((k) => k && k !== 'exact')
  return `hme-pin${selected ? ' is-selected' : ''}${representative ? ' hme-pin--representative' : ''}`
}

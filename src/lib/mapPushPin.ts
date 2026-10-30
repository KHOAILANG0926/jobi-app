// Lee 2026-10-30: 지도 핀 = 빨간 물방울 + 가운데 흰 점(데모 1번), 핀 끝이 위치. 메인·상세 지도, PC·휴대폰 공통. 같은 자리 여러 공고는 흰 숫자.
// 대략 위치(정확하지 않은 점)는 머리를 연하게+점선 테두리로 구분한다(기존 정확도 표시 유지).
export function pushPinClass(kinds: readonly (string | undefined)[], selected = false): string {
  const representative = kinds.some((k) => k && k !== 'exact')
  return `hme-pin${selected ? ' is-selected' : ''}${representative ? ' hme-pin--representative' : ''}`
}

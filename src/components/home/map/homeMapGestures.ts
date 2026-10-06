// 메인 지도 제스처 (2026-10-06 사용자 최종 결정). 데스크톱·모바일 모두 지도 조작 우선.
// - 데스크톱(마우스): MapLibre/VietMap 기본값 — 지도 위 일반 휠=지도 줌, 드래그=지도 이동.
//   지도 밖·왼쪽 필터·오른쪽 패널의 페이지 스크롤은 pageScrollChain.ts가 담당한다.
// - 모바일(터치): SDK 기본값 — 한 손가락=지도 이동(상하좌우), 두 손가락=확대·축소(+이동),
//   탭=POI·건물·공고 핀 선택. 페이지 스크롤은 지도 밖에서. 지도 위 페이지 스크롤을 위해
//   제스처를 바꾸는 시도(cooperativeGestures, 직접 만든 제스처, 지도 조작 모드)는 폐기했다.
//   불편하면 제스처가 아니라 레이아웃(지도 높이·여백)으로 해결한다.
export const TOUCH_DEVICE_QUERY = '(hover: none) and (pointer: coarse)'

/** SDK cooperativeGestures는 쓰지 않는다(Ctrl+휠 강제·한 손가락 페이지 스크롤·안내 overlay 없음). */
export const HOME_MAP_GESTURE_OPTIONS = { cooperativeGestures: false } as const

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_DEVICE_QUERY).matches
}

/** 터치 기기 지도에서 끄는 SDK 핸들러(VietMap·MapLibre 공통). */
export interface TouchMapDefaultsMap {
  touchZoomRotate: { disableRotation(): void }
  touchPitch?: { disable(): void }
}

/** 터치 기기에서만 호출: 두 손가락 회전·기울기를 끈다. 나침반 버튼이 없어(showCompass: false)
 *  실수로 돌아간 지도를 되돌릴 방법이 없기 때문. 한 손가락 이동·핀치 확대는 SDK 기본 그대로. */
export function applyTouchMapDefaults(map: TouchMapDefaultsMap): void {
  map.touchZoomRotate.disableRotation()
  map.touchPitch?.disable()
}

/** 장소(POI) 탭 허용 오차(px): 아이콘·라벨 박스 밖이면 아이콘 중심에서 이 거리 안만 인정. */
export const POI_TAP_TOLERANCE_PX = { mouse: 2, touch: 6 } as const
/** POI 아이콘 반지름(px) 근사. 공식 POI 아이콘 약 16~18px. */
export const POI_ICON_RADIUS_PX = 9

/** 패딩 조회로만 잡힌 POI가 실제 아이콘 근처인지(아이콘 반지름 + 오차 안). */
export function withinPoiIcon(distancePx: number, tolerancePx: number): boolean {
  return distancePx <= POI_ICON_RADIUS_PX + tolerancePx
}

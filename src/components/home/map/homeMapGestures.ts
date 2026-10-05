// 메인 지도 제스처 (2026-10-06). 지도가 페이지 한가운데 있으므로 지도 위에서도 페이지
// 스크롤이 우선이다. MapLibre/VietMap 기본값은 휠=지도 확대, 한 손가락 드래그=지도 이동이고
// 캔버스에 `touch-action: none`을 걸어 지도 위에서 페이지가 스크롤되지 않았다.
// SDK 내장 cooperativeGestures를 켜면:
// - 데스크톱: 휠은 페이지 스크롤, Ctrl(맥 ⌘)+휠·트랙패드 핀치는 지도 확대, 드래그 이동 유지
// - 모바일: 한 손가락은 페이지 스크롤(touch-action: pan-x pan-y), 두 손가락으로 지도 이동·확대
// 안내 문구는 SDK가 지도 위에 잠깐 띄운다(베트남어로 지정).
export const HOME_MAP_GESTURE_OPTIONS = {
  cooperativeGestures: true,
  locale: {
    'CooperativeGesturesHandler.WindowsHelpText': 'Giữ Ctrl và cuộn chuột để phóng to/thu nhỏ bản đồ',
    'CooperativeGesturesHandler.MacHelpText': 'Giữ ⌘ và cuộn để phóng to/thu nhỏ bản đồ',
    'CooperativeGesturesHandler.MobileHelpText': 'Dùng hai ngón tay để di chuyển bản đồ',
  },
} as const

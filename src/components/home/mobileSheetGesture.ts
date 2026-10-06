// 모바일 상세 bottom sheet 손잡이 판정 (MobileDetailSheet).
export type SheetDragResult = 'expand' | 'collapse' | 'close' | 'toggle' | 'stay'

const DRAG_THRESHOLD_PX = 48
const TAP_SLOP_PX = 6

/** 손잡이 드래그 결과(dy: 아래로 +). 짧은 이동은 탭으로 보고 펼침/접힘 전환. */
export function sheetDragResult(dy: number, expanded: boolean): SheetDragResult {
  if (Math.abs(dy) < TAP_SLOP_PX) return 'toggle'
  if (dy <= -DRAG_THRESHOLD_PX) return expanded ? 'stay' : 'expand'
  if (dy >= DRAG_THRESHOLD_PX) return expanded ? 'collapse' : 'close'
  return 'stay'
}

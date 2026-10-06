// 메인 지도 왼쪽 필터·오른쪽 패널의 휠을 페이지로 이어준다 (2026-10-06).
// 두 칸은 각자 overflow-y: auto 스크롤 박스다. Chrome은 연속 휠 동작을 처음 스크롤한
// 박스에 고정(scroll latching)하므로, 안쪽이 끝에 닿은 뒤 이어지는 휠은 버려지고 잠시
// 멈춰야 페이지가 움직였다(실제 Windows 마우스 로그로 확인). 안쪽이 더 못 움직이는
// 방향의 휠만 막고 같은 양만큼 페이지를 스크롤한다. 안쪽 스크롤·Ctrl+휠(브라우저 확대)은
// 브라우저 기본 동작 그대로 둔다.

interface ScrollBox {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

const LINE_HEIGHT_PX = 40

/** wheel delta → px (deltaMode: 0 px, 1 line, 2 page). */
export function wheelDeltaPx(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return deltaY * LINE_HEIGHT_PX
  if (deltaMode === 2) return deltaY * pageHeight
  return deltaY
}

/** 박스가 deltaY 방향으로 더 스크롤할 수 있는가. 소수점 스크롤 오차 1px 허용. */
export function canScrollFurther(box: ScrollBox, deltaY: number): boolean {
  if (deltaY < 0) return box.scrollTop > 1
  if (deltaY > 0) return box.scrollTop + box.clientHeight < box.scrollHeight - 1
  return false
}

function isScrollable(el: Element): boolean {
  const overflowY = getComputedStyle(el).overflowY
  return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight
}

/** container 안 휠이 container(와 그 안쪽 스크롤 박스) 끝에서 막히면 페이지로 넘긴다. 해제 함수 반환. */
export function chainWheelToPage(container: HTMLElement): () => void {
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || event.deltaY === 0) return
    for (let el = event.target instanceof Element ? event.target : null; el; el = el.parentElement) {
      if ((el === container || isScrollable(el)) && canScrollFurther(el, event.deltaY)) return
      if (el === container) break
    }
    event.preventDefault()
    window.scrollBy({ top: wheelDeltaPx(event.deltaY, event.deltaMode, window.innerHeight), behavior: 'instant' })
  }
  container.addEventListener('wheel', onWheel, { passive: false })
  return () => container.removeEventListener('wheel', onWheel)
}

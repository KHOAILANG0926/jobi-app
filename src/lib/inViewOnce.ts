// 요소가 화면 근처에 처음 들어올 때 한 번만 콜백(이후 관찰 중지). 2026-10-15 지도 비용 절감:
// 메인 지도는 화면에 보일 때만 불러온다(VietMap은 타일 요청 수로 과금 — 25요청 = 1건, 요금표 확인).
// IntersectionObserver가 없는 환경은 바로 콜백(지도가 아예 안 뜨는 것보다 낫다).
export type ObserverCtor = new (cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => {
  observe: (el: Element) => void
  disconnect: () => void
}

export function observeInViewOnce(
  el: Element,
  onVisible: () => void,
  Ctor: ObserverCtor | undefined = typeof IntersectionObserver === 'undefined' ? undefined : IntersectionObserver,
  rootMargin = '200px',
): () => void {
  if (!Ctor) { onVisible(); return () => {} }
  let done = false
  const io = new Ctor((entries) => {
    if (done || !entries.some((e) => e.isIntersecting)) return
    done = true
    io.disconnect()
    onVisible()
  }, { rootMargin })
  io.observe(el)
  return () => io.disconnect()
}

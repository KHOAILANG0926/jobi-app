// 화면에 보이는 동안만 흐르는 timeout (2026-10-06).
// 지도 SDK는 style 적용·첫 렌더를 requestAnimationFrame으로 처리하는데, 숨겨진 탭에서는 rAF가
// 멈춘다. 예전에는 메인 지도 초기화 timeout(12초)이 숨겨진 동안에도 흘러, 링크를 새 탭으로
// 열면 VietMap이 준비되기 전에 Geoapify 예비 지도로 넘어가고 탭을 열어도 돌아오지 않았다.
export interface VisibilityEnv {
  isVisible: () => boolean
  onVisibilityChange: (listener: () => void) => () => void
  setTimeout: (fn: () => void, ms: number) => number
  clearTimeout: (id: number) => void
  now: () => number
}

export function browserVisibilityEnv(): VisibilityEnv {
  return {
    isVisible: () => document.visibilityState !== 'hidden',
    onVisibilityChange: (listener) => {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    now: () => performance.now(),
  }
}

/** ms만큼 "보이는 시간"이 지나면 onTimeout. 반환 함수로 취소. */
export function startVisibleTimeout(ms: number, onTimeout: () => void, env: VisibilityEnv = browserVisibilityEnv()): () => void {
  let remaining = ms
  let startedAt = 0
  let timer: number | null = null
  let done = false
  const run = () => {
    if (done || timer !== null || !env.isVisible()) return
    startedAt = env.now()
    timer = env.setTimeout(() => { timer = null; done = true; onTimeout() }, Math.max(0, remaining))
  }
  const pause = () => {
    if (timer === null) return
    env.clearTimeout(timer)
    timer = null
    remaining -= env.now() - startedAt
  }
  const stopListening = env.onVisibilityChange(() => (env.isVisible() ? run() : pause()))
  run()
  return () => {
    done = true
    if (timer !== null) env.clearTimeout(timer)
    timer = null
    stopListening()
  }
}

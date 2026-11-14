import { useSyncExternalStore } from 'react'
import { msUntilNextVnMidnight, todayVn } from './jobDetailView'

// 오늘 날짜(베트남)를 구독하는 한 곳 — 화면을 열어 둔 채 자정이 지나면 마감 공고를 다시 거르게 한다(#728 R4, Codex P1).
// 렌더 때 날짜를 읽기만 하면 목록이 다시 그려지지 않는 한 옛 날짜로 남는다. 그래서 날짜가 바뀌는 순간 구독자를 깨운다.
// 노트북 절전·탭 숨김으로 타이머가 늦게 울릴 수 있어 화면이 다시 보일 때도 날짜를 다시 읽는다.
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
let lastDay = todayVn()

function tick() {
  const day = todayVn()
  if (day !== lastDay) {
    lastDay = day
    listeners.forEach((l) => l())
  }
  schedule()
}
function schedule() {
  if (timer !== undefined) clearTimeout(timer)
  timer = listeners.size ? setTimeout(tick, msUntilNextVnMidnight() + 50) : undefined
}
const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') tick() }

export function getTodayVn(): string {
  return todayVn()
}

export function subscribeTodayVn(listener: () => void): () => void {
  if (!listeners.size && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  listeners.add(listener)
  lastDay = todayVn()
  schedule()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      schedule()
    }
  }
}

/** 오늘 날짜(YYYY-MM-DD, 베트남). 자정이 지나면 이 값을 쓰는 화면이 다시 그려진다. */
export function useTodayVn(): string {
  return useSyncExternalStore(subscribeTodayVn, getTodayVn, getTodayVn)
}

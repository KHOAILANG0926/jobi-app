// 브라우저 환경 어댑터(구조 정리 3번): 웹·앱 입구가 시작할 때 한 번 불러 데이터 계층(kvStore·eventBus)에 브라우저의 localStorage·sessionStorage·window 이벤트를 끼운다.
// 브라우저 전역을 만지는 곳을 이 파일 하나로 모으는 것이 목적이다 — layers.test.ts가 src/lib의 다른 파일이 직접 만지지 못하게 막는다.
import { installEventBus, type EventBusAdapter, type VgbEventName } from './eventBus'
import { installKvStores, type KeyValueStore } from './kvStore'

const wrap = (s: Storage): KeyValueStore => ({ get: (k) => s.getItem(k), set: (k, v) => s.setItem(k, v), remove: (k) => s.removeItem(k) })

/** 브라우저 저장소 접근이 막힌 경우(프라이빗 모드 등)는 예전처럼 호출 시점에 던진다 — 호출하는 쪽의 try/catch가 그대로 받는다. */
const lazy = (get: () => Storage): KeyValueStore => ({ get: (k) => wrap(get()).get(k), set: (k, v) => wrap(get()).set(k, v), remove: (k) => wrap(get()).remove(k) })

export const browserEventBus: EventBusAdapter = {
  emit: (name: VgbEventName) => { window.dispatchEvent(new CustomEvent('vgb:' + name)) },
  subscribe: (name: VgbEventName, handler: () => void) => {
    const type = 'vgb:' + name
    window.addEventListener(type, handler)
    return () => window.removeEventListener(type, handler)
  },
}

export function installBrowserEnv(): void {
  installKvStores({ local: lazy(() => window.localStorage), session: lazy(() => window.sessionStorage) })
  installEventBus(browserEventBus)
}

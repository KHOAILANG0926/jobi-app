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

/** 새 버전이 배포돼 옛 조각 파일(assets/*.js)이 사라진 뒤, 그 전에 열어 둔 탭이 아직 안 받은 화면을 받으려 하면 Vite가 'vite:preloadError'를 보낸다.
 *  그대로 두면 React가 화면 전체를 내려 빈 화면이 된다(격리 실제 스택 E2E U1로 확인, #1070 G) — 새로고침해 새 빌드를 받는다. 무한 새로고침을 막으려 1분 안에는 한 번만. */
function installStaleBuildRecovery(): void {
  const KEY = 'vgb:stale-build-reload'
  // 직전 새로고침 시각: 세션 저장소가 막혀 있으면(프라이빗 모드 등) 같은 탭에서 새로고침을 건너 남는 window.name에 대신 적는다 — 저장소가 막힌 탭이 새로고침을 무한 반복하지 않게.
  const last = (): number => {
    try { const v = window.sessionStorage.getItem(KEY); if (v) return Number(v) } catch { /* 아래 window.name으로 */ }
    const m = new RegExp(KEY + '=(\\d+)').exec(window.name)
    return m ? Number(m[1]) : 0
  }
  const mark = (t: number): void => {
    try { window.sessionStorage.setItem(KEY, String(t)) } catch { /* 아래 window.name으로 */ }
    window.name = window.name.replace(new RegExp(KEY + '=\\d+;?'), '') + `${KEY}=${t};`
  }
  window.addEventListener('vite:preloadError', (event) => {
    if (Date.now() - last() < 60_000) return
    mark(Date.now())
    event.preventDefault()
    window.location.reload()
  })
}

export function installBrowserEnv(): void {
  installStaleBuildRecovery()
  installKvStores({ local: lazy(() => window.localStorage), session: lazy(() => window.sessionStorage) })
  installEventBus(browserEventBus)
}

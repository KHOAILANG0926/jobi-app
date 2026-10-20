// 이용자 위치(첫 방문 위치 허용, 2026-10-19 Lee 결정 / 2026-10-20 문구 확정).
// - 처음 들어온 사람에게 한 번만 묻는다(로그인 무관, 거절해도 앱 사용 가능).
// - 허용한 위치는 메인 지도 거리 계산에 쓴다. Google 길찾기는 출발지를 비워 두면 Google이 이용자 위치에서 출발한다.
// - 위치는 서버로 보내지 않는다. 이 브라우저 안에서만 쓴다.
export interface UserPoint { lat: number; lng: number; accuracy: number; at: number }
const ASKED_KEY = 'vgb_location_prompt_v1'
let current: UserPoint | null = null
const listeners = new Set<(p: UserPoint) => void>()

function storage(): Storage | null { try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null } }
export function promptAlreadyAsked(): boolean { try { return storage()?.getItem(ASKED_KEY) != null } catch { return true } }
export function markPromptAsked(answer: 'allow' | 'later' | 'denied'): void { try { storage()?.setItem(ASKED_KEY, answer) } catch { /* 저장 불가 브라우저: 다음 방문에 다시 물을 수 있음 */ } }
/** 자동 검사(화면 측정·스모크)에서는 창을 띄우지 않는다 — 승인된 화면 틀 측정을 가리지 않게. */
export function isAutomation(): boolean { try { return typeof navigator !== 'undefined' && navigator.webdriver === true } catch { return false } }

export function getUserLocation(): UserPoint | null { return current }
export function onUserLocation(fn: (p: UserPoint) => void): () => void { listeners.add(fn); return () => { listeners.delete(fn) } }
function publish(p: UserPoint) { current = p; listeners.forEach((fn) => fn(p)) }

/** 브라우저 위치 권한을 요청한다. 성공하면 지도에 알린다. */
export function requestUserLocation(): Promise<UserPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() }
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) { resolve(null); return }
        publish(p); resolve(p)
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

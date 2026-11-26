// 데이터가 바뀌었다는 알림(구조 정리 3번): 저장·지원·알림 등 데이터 계층이 쓰던 `window.dispatchEvent(new CustomEvent('vgb:…'))`를
// 이 인터페이스 뒤로 옮겼다. 기본 구현은 메모리(서버·Node·시험에서도 동작). 브라우저 입구가 browserEnv로 window 이벤트를 끼우면
// 'vgb:이름' 이벤트가 예전과 똑같이 발생하므로, 아직 window.addEventListener('vgb:…')로 듣는 웹 화면은 고치지 않아도 그대로 동작한다.
// 이 파일은 브라우저를 만지지 않는다.
export type VgbEventName =
  | 'saved-jobs' | 'applications' | 'notifications' | 'messages' | 'interviews' | 'jobs'
  | 'cv-saved' | 'account-cv-saved' | 'profile-saved' | 'view-history' | 'recommend-prefs' | 'company-reviews'

export interface EventBusAdapter {
  emit(name: VgbEventName): void
  subscribe(name: VgbEventName, handler: () => void): () => void
}

export function createMemoryBus(): EventBusAdapter {
  const handlers = new Map<VgbEventName, Set<() => void>>()
  return {
    emit(name) { for (const h of [...(handlers.get(name) ?? [])]) h() },
    subscribe(name, handler) {
      let set = handlers.get(name)
      if (!set) { set = new Set(); handlers.set(name, set) }
      set.add(handler)
      return () => { set!.delete(handler) }
    },
  }
}

let bus: EventBusAdapter = createMemoryBus()

export const emitEvent = (name: VgbEventName): void => bus.emit(name)
/** 듣기 시작. 돌려주는 함수를 부르면 듣기를 멈춘다(React effect 정리 함수로 그대로 쓴다). */
export const onEvent = (name: VgbEventName, handler: () => void): (() => void) => bus.subscribe(name, handler)
export function installEventBus(adapter: EventBusAdapter): void { bus = adapter }

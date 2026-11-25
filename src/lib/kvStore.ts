// 키-값 저장소 인터페이스(구조 정리 3번): 브라우저 localStorage·sessionStorage에 직접 기대던 데이터 계층이 이 인터페이스 뒤에서 읽고 쓴다.
// 기본 구현은 메모리라 서버·Node·시험에서도 그대로 돌고(저장은 그 프로세스 안에서만), 브라우저 입구(src/main.tsx·src/app/main.tsx)가
// browserEnv로 진짜 localStorage·sessionStorage를 끼운다. 나중에 네이티브 앱은 같은 인터페이스에 다른 저장소를 끼우면 된다.
// 이 파일은 브라우저를 만지지 않는다(layers.test.ts R1·R2의 서버 묶음에 들어와도 안전).
export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function createMemoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { get: (k) => (m.has(k) ? m.get(k)! : null), set: (k, v) => { m.set(k, v) }, remove: (k) => { m.delete(k) } }
}

let local: KeyValueStore = createMemoryStore()
let session: KeyValueStore = createMemoryStore()

/** 이 기기에 오래 남는 저장소(웹의 localStorage). 호출하는 쪽의 try/catch 동작은 그대로다 — 끼운 저장소가 던지면 그대로 던진다. */
export const kvLocal: KeyValueStore = { get: (k) => local.get(k), set: (k, v) => local.set(k, v), remove: (k) => local.remove(k) }
/** 탭·세션 동안만 남는 저장소(웹의 sessionStorage). */
export const kvSession: KeyValueStore = { get: (k) => session.get(k), set: (k, v) => session.set(k, v), remove: (k) => session.remove(k) }

export function installKvStores(stores: { local?: KeyValueStore; session?: KeyValueStore }): void {
  if (stores.local) local = stores.local
  if (stores.session) session = stores.session
}

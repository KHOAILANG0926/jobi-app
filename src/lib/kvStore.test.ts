import { createMemoryStore, installKvStores, kvLocal, kvSession } from './kvStore.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }

// 기본은 메모리: 서버·Node에서도 읽고 쓰기가 되고 없는 키는 null
assert(kvLocal.get('a') === null, '없는 키는 null')
kvLocal.set('a', '1'); assert(kvLocal.get('a') === '1', '쓴 값을 읽음')
kvLocal.remove('a'); assert(kvLocal.get('a') === null, '지우면 null')
kvLocal.set('b', '2'); kvSession.set('b', 'S')
assert(kvLocal.get('b') === '2' && kvSession.get('b') === 'S', 'local과 session은 따로')

// 끼운 저장소로 바뀌고, 저장소가 던지면 그대로 던진다(예전 localStorage 접근 막힘과 같은 동작 — 호출하는 쪽 try/catch가 받음)
const backing = createMemoryStore()
installKvStores({ local: backing })
kvLocal.set('c', '3'); assert(backing.get('c') === '3', '끼운 저장소에 쓴다')
assert(kvSession.get('b') === 'S', 'session은 바꾸지 않았으면 그대로')
installKvStores({ local: { get() { throw new Error('blocked') }, set() { throw new Error('blocked') }, remove() { throw new Error('blocked') } } })
let threw = false
try { kvLocal.get('x') } catch { threw = true }
assert(threw, '저장소 접근이 막히면 호출하는 쪽에서 잡을 수 있게 던진다')
console.log('kvStore: memory default / install / throw-through passed')

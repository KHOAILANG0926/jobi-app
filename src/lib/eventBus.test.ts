import { createMemoryBus, emitEvent, installEventBus, onEvent } from './eventBus.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }

// 기본은 메모리: 같은 이름에 건 듣기만 받는다, 끄면 더는 안 받는다
let a = 0, b = 0
const offA = onEvent('applications', () => { a++ })
onEvent('saved-jobs', () => { b++ })
emitEvent('applications'); emitEvent('applications')
assert(a === 2 && b === 0, '이벤트 이름별로 따로 받는다')
offA(); emitEvent('applications')
assert(a === 2, 'off 뒤에는 받지 않는다')
// 듣는 도중 off 해도 같은 emit이 안전
const bus = createMemoryBus()
installEventBus(bus)
let n = 0
const off1 = onEvent('messages', () => { n++; off1() })
onEvent('messages', () => { n++ })
emitEvent('messages'); emitEvent('messages')
assert(n === 3, '듣는 도중 자기 자신을 끄는 경우(첫 emit 2번, 둘째 emit 1번)')
console.log('eventBus: memory default / names / off passed')

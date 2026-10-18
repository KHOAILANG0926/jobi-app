import { locationVerdict } from './locationLevel.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
const done = (kind: string) => ({ state: 'done', failures: 0, calls: 0, kind })
// 실제 공고
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['KCN Yên Phong, Bắc Ninh', 'KCN YÊN PHONG', 'KCN Yên Phong'] }) === 'located', '#4824 KDA: KCN named (not in park table yet) → located, never deleted')
assert(locationVerdict({ hasExact: false, state: done('area'), texts: ['Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh'] }) === 'located', '#4828 after ward fix: area → located')
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['Bắc Ninh'] }) === 'unlocated', 'province only → unlocated')
assert(locationVerdict({ hasExact: true, state: null, texts: ['Bắc Ninh'] }) === 'located', 'approved coordinate wins')
assert(locationVerdict({ hasExact: false, state: null, texts: ['Bắc Ninh'] }) === 'pending', 'not processed yet → pending (do not hide)')
assert(locationVerdict({ hasExact: false, state: { state: 'failed', failures: 1, calls: 1, kind: 'unresolved' }, texts: ['Bắc Ninh'] }) === 'pending', 'VietMap outage once → retry, not hidden')
assert(locationVerdict({ hasExact: false, state: { state: 'failed', failures: 2, calls: 2, kind: 'unresolved' }, texts: ['Bắc Ninh'] }) === 'unlocated', 'two failures → unlocated')
assert(locationVerdict({ hasExact: false, state: { state: 'deferred', failures: 0, calls: 0, kind: 'unresolved' }, texts: ['Bắc Ninh'] }) === 'pending', 'daily cap → wait, not hidden')
assert(locationVerdict({ hasExact: false, state: { state: 'processing', failures: 0, calls: 0, kind: null }, texts: ['Bắc Ninh'] }) === 'pending', 'processing → pending')
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['Khu phố Mao Yên, Bắc Ninh'] }) === 'unlocated', 'khu phố is not a park')
console.log('locationLevel tests: all assertions passed')

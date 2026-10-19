import { hasLocationDetail, locationVerdict } from './locationLevel.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
const done = (kind: string) => ({ state: 'done', failures: 0, calls: 0, kind })
// 실제 공고
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['KCN Yên Phong, Bắc Ninh', 'KCN YÊN PHONG', 'KCN Yên Phong'] }) === 'located', '#4824 KDA: KCN named (not in park table yet) → located, never deleted')
assert(locationVerdict({ hasExact: false, state: done('area'), texts: ['Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh'] }) === 'located', '#4828 after ward fix: area → located')
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['Bắc Ninh'] }) === 'no_info', 'province only, nothing in source → no_info (delete)')
assert(locationVerdict({ hasExact: true, state: null, texts: ['Bắc Ninh'] }) === 'located', 'approved coordinate wins')
assert(locationVerdict({ hasExact: false, state: null, texts: ['Bắc Ninh'] }) === 'pending', 'not processed yet → pending (do not hide)')
assert(locationVerdict({ hasExact: false, state: { state: 'failed', failures: 1, calls: 1, kind: 'unresolved' }, texts: ['Bắc Ninh'] }) === 'pending', 'VietMap outage once → retry, not hidden')
assert(locationVerdict({ hasExact: false, state: { state: 'failed', failures: 2, calls: 2, kind: 'unresolved' }, texts: ['Bắc Ninh'] }) === 'no_info', 'two failures, province only → no_info')
assert(locationVerdict({ hasExact: false, state: { state: 'deferred', failures: 0, calls: 0, kind: 'unresolved' }, texts: ['Bắc Ninh'] }) === 'pending', 'daily cap → wait, not hidden')
assert(locationVerdict({ hasExact: false, state: { state: 'processing', failures: 0, calls: 0, kind: null }, texts: ['Bắc Ninh'] }) === 'pending', 'processing → pending')
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['Khu phố Mao Yên, Bắc Ninh'] }) === 'our_miss', 'khu phố is not a park, but address exists → our_miss (hide + evening list, never auto-delete)')
// 실제로 못 찾았던 주소(10-13 기록): 모두 주소가 있음 → 우리 잘못(our_miss), 삭제 아님
for (const a of ['125 Đường Nguyễn Thị Minh Khai, Phường Kinh Bắc, Thành phố Bắc Ninh, Bắc Ninh', '6-8 Khu 1, phường Quế Võ, tỉnh Bắc Ninh', 'Phố  Nguyễn Trãi, Phường Hạp Lĩnh, Thành phố Bắc Ninh, Bắc Ninh'])
  assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: [a] }) === 'our_miss', `our_miss: ${a}`)
// 위치 칸은 성뿐이지만 원문 글에 주소가 있으면 우리가 못 뽑은 것 → our_miss
assert(locationVerdict({ hasExact: false, state: done('unresolved'), texts: ['Bắc Ninh'], sourceText: 'Địa chỉ: thôn Đông, xã Tam Đa' }) === 'our_miss', 'address only in source text → our_miss')
assert(!hasLocationDetail(['Bắc Ninh', 'Tỉnh Bắc Ninh, Việt Nam'], 'Tuyển công nhân. Lương 8tr. Liên hệ 0912345678'), 'province + no address words → no detail')
assert(hasLocationDetail(['Bắc Ninh'], 'Làm tại KCN Quế Võ'), 'KCN in source → detail')
console.log('locationLevel tests: all assertions passed')

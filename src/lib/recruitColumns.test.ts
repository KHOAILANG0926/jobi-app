// 상세 모집조건 두 칸 — 2026-11-01 Lee: 왼쪽이 비면 오른쪽 내용을 왼쪽으로.
import { recruitColumnsOf } from './recruitColumns.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const keys = (c: Array<Array<{ key: string }>>) => JSON.stringify(c.map((g) => g.map((f) => f.key)))
// #5157: 직무 행 + 업종(모바일 전용)만 → 한 칸, 직무가 왼쪽
assert(keys(recruitColumnsOf([{ key: 'roles' }, { key: 'category' }])) === '[["roles","category"]]', '#5157 직무 왼쪽으로')
// 양쪽 다 있으면 그대로 두 칸
assert(keys(recruitColumnsOf([{ key: 'roles' }, { key: 'deadline' }, { key: 'education' }])) === '[["deadline"],["roles","education"]]', '두 칸 유지')
// 오른쪽이 비면 한 칸
assert(keys(recruitColumnsOf([{ key: 'age' }, { key: 'gender' }])) === '[["age","gender"]]', '오른쪽 비면 한 칸')
assert(keys(recruitColumnsOf([])) === '[]', '없음')
console.log('recruitColumns.test.ts: 왼쪽 빈칸 당기기 4개 경우 통과')

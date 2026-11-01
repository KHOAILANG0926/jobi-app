// 상세 모집조건 순번 배치 — 2026-11-01 Lee: 1 왼쪽, 2 오른쪽, 3 다음 줄 왼쪽 … 없는 항목은 건너뜀.
import { recruitOrdered } from './recruitColumns.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const keys = (fs: Array<{ key: string }>) => fs.map((f) => f.key).join(',')
assert(keys(recruitOrdered([{ key: 'category' }, { key: 'roles' }])) === 'roles,category', '#5157 직무가 1번')
assert(keys(recruitOrdered([{ key: 'education' }, { key: 'gender' }, { key: 'deadline' }, { key: 'roles' }, { key: 'age' }])) === 'roles,deadline,age,gender,education', '확정 순서')
assert(keys(recruitOrdered([{ key: 'trip' }, { key: 'otherReq' }, { key: 'numHires' }])) === 'numHires,otherReq,trip', '확정안 밖 항목은 뒤')
assert(keys(recruitOrdered([])) === '', '없음')
console.log('recruitColumns.test.ts: 모집조건 순번 4개 경우 통과')

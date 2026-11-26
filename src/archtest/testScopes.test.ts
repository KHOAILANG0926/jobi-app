import { includeTest, isAlwaysTest, scopeOfTest, scopesForChanges } from './testScopes'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }

// 시험 파일 → 범위
assert(scopeOfTest('src/app/map/fitViewport.test.ts') === 'app', '앱 시험')
assert(scopeOfTest('src/components/home/map/homeMapClusters.test.ts') === 'web', '웹 시험(components)')
assert(scopeOfTest('src/pages/jobsMenu/x.test.ts') === 'web', '웹 시험(pages)')
assert(scopeOfTest('src/lib/salaryReader.test.ts') === 'shared', '공통 시험(lib)')
assert(scopeOfTest('api/map-locations.test.ts') === 'shared', '공통 시험(api)')
assert(scopeOfTest('src/context/x.test.ts') === 'shared', '공통 시험(context)')
assert(scopeOfTest('scripts/foo.test.ts') === null, '어디에도 안 맞으면 null')

// 범위 선택: 해당 범위 + 경계·계층 시험 + 범위를 모르는 시험은 항상
assert(isAlwaysTest('src/app/boundary.test.ts') && isAlwaysTest('src/archtest/layers.test.ts') && !isAlwaysTest('src/app/map/fitViewport.test.ts'), '경계·계층 시험은 항상')
assert(includeTest('src/app/map/fitViewport.test.ts', 'app') && !includeTest('src/app/map/fitViewport.test.ts', 'web'), '앱 시험은 앱 범위에서만')
assert(includeTest('src/lib/salaryReader.test.ts', 'shared') && !includeTest('src/lib/salaryReader.test.ts', 'app'), '공통 시험은 공통 범위에서만')
assert(includeTest('src/app/boundary.test.ts', 'web') && includeTest('src/archtest/layers.test.ts', 'app'), '경계·계층 시험은 어느 범위든')
assert(includeTest('scripts/foo.test.ts', 'app'), '범위를 모르는 시험은 항상 돌림(닫힌 방향)')
assert(includeTest('src/lib/a.test.ts', 'all') && includeTest('src/app/a.test.ts', 'all'), 'all은 전부')

// 바뀐 파일 → 범위: 전용 변경만 줄이고 공통·미분류는 전부
const eq = (a: ReturnType<typeof scopesForChanges>, b: string) => (a === 'all' ? 'all' : [...a].sort().join(',')) === b
assert(eq(scopesForChanges(['src/app/detail/DetailScreen.tsx', 'src/app/app.css']), 'app'), '앱만 바뀌면 app')
assert(eq(scopesForChanges(['src/pages/JobDetail.tsx', 'src/components/SalaryText.tsx']), 'web'), '웹만 바뀌면 web')
assert(eq(scopesForChanges(['src/app/a.tsx', 'src/pages/P.tsx']), 'app,web'), '앱+웹 전용이면 둘 다')
assert(eq(scopesForChanges(['src/app/a.tsx', 'src/lib/storage.ts']), 'all'), '공통(lib)이 끼면 전부')
assert(eq(scopesForChanges(['src/context/AuthContext.tsx']), 'all'), '공통(context) 변경은 전부')
assert(eq(scopesForChanges(['api/ssr.js']), 'all'), 'api 변경은 전부')
assert(eq(scopesForChanges(['package.json']), 'all'), '미분류 파일은 전부')
assert(eq(scopesForChanges(['crawler/x.py']), 'all'), '크롤러 등 다른 영역은 줄이지 않음')
assert(eq(scopesForChanges([]), 'all'), '목록이 비면 전부')
console.log('testScopes: scope of tests / scope selection / changed-file mapping passed')

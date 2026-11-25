// Runs every src/**/*.test.ts and api/**/*.test.ts sequentially (Node's
// native TS execution + ts-extensionless-loader.mjs so pre-existing
// extensionless relative imports resolve). Each test file is plain
// assertions that throw on failure and print a "... all assertions passed"
// line on success (see jobRows.test.ts). api/ is included alongside src/
// because it holds Vercel serverless functions (Node-only globals like
// process/node:test) that intentionally sit outside tsconfig.json's
// `include: ["src"]" — see api/_zalo-token.test.ts.
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = [join(import.meta.dirname, '..', 'src'), join(import.meta.dirname, '..', 'api')]

function findTests(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...findTests(full))
    else if (name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

// 범위 선택(구조 정리 5번): `--scope=app|web|shared`는 그 범위 시험 + 경계·계층 시험만, `--changed[=기준]`은 바뀐 파일(기준…HEAD, 기본 origin/master)로 범위를 정한다.
// 아무 옵션이 없으면(npm test, 필수 CI) 예전과 똑같이 전부 돌린다. 규칙은 src/archtest/testScopes.ts 한 곳.
import { includeTest, scopesForChanges } from '../src/archtest/testScopes.ts'
const args = process.argv.slice(2)
const scopeArg = args.find((a) => a.startsWith('--scope='))?.slice('--scope='.length)
const changedArg = args.find((a) => a === '--changed' || a.startsWith('--changed='))
let scopes = ['all']
if (scopeArg) {
  if (!['all', 'app', 'web', 'shared'].includes(scopeArg)) { console.error(`알 수 없는 --scope=${scopeArg} (all|app|web|shared)`); process.exit(2) }
  scopes = [scopeArg]
} else if (changedArg) {
  const base = changedArg.includes('=') ? changedArg.slice(changedArg.indexOf('=') + 1) : 'origin/master'
  let files = []
  try { files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean) } catch { files = [] }
  const picked = scopesForChanges(files)
  scopes = picked === 'all' ? ['all'] : picked
  console.log(`바뀐 파일 ${files.length}개 → 시험 범위: ${scopes.join('+')}`)
}
const allTests = roots.flatMap(findTests)
const tests = allTests.filter((f) => scopes.some((sc) => includeTest(relative(join(import.meta.dirname, '..'), f).split('\\').join('/'), sc)))
if (scopes[0] !== 'all') console.log(`시험 ${tests.length}/${allTests.length}개 실행(범위 ${scopes.join('+')} + 경계·계층 시험)`)
let failed = 0
const cwd = process.cwd()
const toPosixRelative = (p) => relative(cwd, p).split('\\').join('/')
const registerPath = './' + toPosixRelative(join(import.meta.dirname, 'ts-extensionless-register.mjs'))

for (const file of tests) {
  // Windows: an absolute "C:\..." path passed as the entry-point arg gets
  // misparsed as a URL (drive letter looks like a scheme) by Node's loader —
  // pass a cwd-relative, forward-slash path instead.
  const rel = toPosixRelative(file)
  console.log(`\n--- ${rel} ---`)
  try {
    execFileSync(
      process.execPath,
      // --experimental-test-module-mocks: needed by api/_zalo-token.test.ts's
      // node:test mock.module() (stubs @supabase/supabase-js so it can run the
      // real api/zalo-token.js handler without touching production Auth).
      // Purely additive — a no-op for every other test file.
      ['--experimental-strip-types', '--experimental-test-module-mocks', '--import', registerPath, rel],
      { stdio: 'inherit', cwd },
    )
  } catch {
    failed++
  }
}
console.log(`\n${tests.length - failed}/${tests.length} test files passed.`)
process.exit(failed > 0 ? 1 : 0)

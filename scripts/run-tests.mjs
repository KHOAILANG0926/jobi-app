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

const tests = roots.flatMap(findTests)
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

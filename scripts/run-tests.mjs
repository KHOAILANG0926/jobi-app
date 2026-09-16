// Runs every src/**/*.test.ts sequentially (Node's native TS execution +
// ts-extensionless-loader.mjs so pre-existing extensionless relative imports
// resolve). Each test file is plain assertions that throw on failure and
// print a "... all assertions passed" line on success (see jobRows.test.ts).
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..', 'src')

function findTests(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...findTests(full))
    else if (name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const tests = findTests(root)
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
      ['--experimental-strip-types', '--import', registerPath, rel],
      { stdio: 'inherit', cwd },
    )
  } catch {
    failed++
  }
}
console.log(`\n${tests.length - failed}/${tests.length} test files passed.`)
process.exit(failed > 0 ? 1 : 0)

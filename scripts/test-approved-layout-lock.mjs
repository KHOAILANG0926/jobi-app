import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const root = mkdtempSync(join(tmpdir(), 'layout-lock-'))
try {
  mkdirSync(join(root, 'src'), { recursive: true })
  const original = 'approved layout'
  writeFileSync(join(root, 'src/card.tsx'), original)
  writeFileSync(join(root, 'baseline.json'), JSON.stringify({ files: { 'src/card.tsx': createHash('sha256').update(original).digest('hex') } }))
  const run = () => spawnSync(process.execPath, ['scripts/check-approved-layout.mjs', root, join(root, 'baseline.json')], { encoding: 'utf8' })
  assert.equal(run().status, 0, 'unchanged approved source must pass')
  writeFileSync(join(root, 'src/card.tsx'), original + ' changed')
  const changed = run()
  assert.notEqual(changed.status, 0, 'layout edit must fail')
  assert.match(changed.stderr, /src\/card.tsx/, 'failure must identify changed file')
  rmSync(join(root, 'src/card.tsx'))
  assert.notEqual(run().status, 0, 'deleting approved layout must fail')
  writeFileSync(join(root, 'src/card.tsx'), original)
  const trusted = join(root, 'trusted')
  mkdirSync(trusted)
  mkdirSync(join(root, 'scripts'))
  const manifest = readFileSync(join(root, 'baseline.json'))
  const checker = readFileSync('scripts/check-approved-layout.mjs')
  for (const target of [trusted, join(root, 'scripts')]) {
    writeFileSync(join(target, 'approved-layout-lock.json'), manifest)
    writeFileSync(join(target, 'check-approved-layout.mjs'), checker)
  }
  const trustedRun = () => spawnSync(process.execPath, ['scripts/check-approved-layout.mjs', root, join(trusted, 'approved-layout-lock.json'), '--trusted'], { encoding: 'utf8' })
  assert.equal(trustedRun().status, 0)
  writeFileSync(join(root, 'scripts/approved-layout-lock.json'), '{}')
  assert.notEqual(trustedRun().status, 0, 'candidate cannot replace approved manifest')
  writeFileSync(join(root, 'scripts/approved-layout-lock.json'), manifest)
  writeFileSync(join(root, 'scripts/check-approved-layout.mjs'), 'process.exit(0)')
  assert.notEqual(trustedRun().status, 0, 'candidate cannot replace checker')
  console.log('approved layout lock: unchanged PASS; modified/deleted BLOCKED')
} finally { rmSync(root, { recursive: true, force: true }) }

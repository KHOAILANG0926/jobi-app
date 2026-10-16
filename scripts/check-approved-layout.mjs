// Run the trusted base-branch copy, with its trusted manifest, against candidate files.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
const root = resolve(process.argv[2] || '.')
const manifestPath = resolve(process.argv[3] || 'scripts/approved-layout-lock.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const failures = []
for (const [path, expected] of Object.entries(manifest.files)) {
  try {
    const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')
    if (actual !== expected) failures.push(path)
  } catch { failures.push(path + ' (missing)') }
}
// A PR cannot redefine the baseline or replace the trusted checker to approve itself.
if (process.argv.includes('--trusted')) {
  for (const path of ['scripts/approved-layout-lock.json', 'scripts/check-approved-layout.mjs']) {
    const trusted = resolve(dirname(manifestPath), path.split('/').at(-1))
    try { if (!readFileSync(trusted).equals(readFileSync(resolve(root, path)))) failures.push(path) }
    catch { failures.push(path + ' (missing)') }
  }
}
if (failures.length) {
  console.error('APPROVED_LAYOUT_CHANGED: explicit user-approved baseline update required\n' + failures.join('\n'))
  process.exit(1)
}
console.log('Approved layout source lock: ' + Object.keys(manifest.files).length + ' files unchanged')

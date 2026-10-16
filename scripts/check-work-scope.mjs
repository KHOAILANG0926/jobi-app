// Execute this script from the trusted base branch. Never execute candidate code.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const repo = resolve(process.env.SCOPE_REPO || '.')
const [base, head] = process.argv.slice(2)
if (![base, head].every(s => /^[0-9a-f]{40}$/.test(s || ''))) throw new Error('Exact base/head SHAs required')
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 20_000_000 })
const read = (sha, path) => { try { return git('show', `${sha}:${path}`) } catch { return null } }
const hash = text => createHash('sha256').update(text).digest('hex')
const scopePath = 'docs/work-orders/current.json'
const protectedPath = p => /^(src\/|public\/|api\/|\.github\/workflows\/|scripts\/)/.test(p)
  || /^(index\.html|vite\.config\.[^/]+|package(?:-lock)?\.json|AGENTS\.md|CLAUDE\.md|VIECGANBAN_STRUCTURE_BASELINE\.md)$/.test(p)
const changed = git('diff', '--name-only', '--no-renames', base, head).trim().split('\n').filter(Boolean)
const governed = changed.filter(protectedPath)
if (!governed.length) {
  if (changed.includes(scopePath)) validateScope(JSON.parse(read(head, scopePath)))
  console.log('Scope planning/docs only: no application/template changes')
  process.exit(0)
}
const saved = read(base, scopePath)
if (!saved) throw new Error('WORK_SCOPE_MISSING: merge the scope-only work order before implementation')
if (read(head, scopePath) !== saved) throw new Error('WORK_SCOPE_CHANGED: cannot broaden scope together with implementation')
const scope = JSON.parse(saved)
validateScope(scope)
for (const [path, expected] of Object.entries(scope.rules)) {
  const contents = read(base, path)
  if (contents === null || hash(contents) !== expected) throw new Error(`RULES_CHANGED: re-read and re-plan ${path}`)
}
const failures = []
for (const path of governed) {
  const operations = scope.patches.filter(p => p.path === path)
  if (!operations.length) { failures.push(`${path}: outside declared scope`); continue }
  let expected = read(base, path)
  for (const patch of operations) {
    if (patch.kind === 'create') {
      if (expected !== null) throw new Error(`${path}: create requires a new file`)
      expected = patch.after
    } else if (patch.kind === 'delete') {
      if (expected === null || hash(expected) !== patch.before_sha256) throw new Error(`${path}: delete baseline mismatch`)
      expected = null
    } else {
      if (expected === null || !expected.includes(patch.before) || expected.split(patch.before).length !== 2)
        throw new Error(`${path}: declared region missing/ambiguous; re-plan`)
      expected = expected.replace(patch.before, () => patch.after)
    }
  }
  if (read(head, path) !== expected) failures.push(`${path}: changes outside declared region`)
}
if (failures.length) throw new Error('WORK_SCOPE_VIOLATION:\n' + failures.join('\n'))
console.log(`Work scope ${scope.id}: ${governed.length} application/guard files match declared regions; rules hashes current`)
function validateScope(scope) {
  if (!scope || typeof scope.id !== 'string' || !scope.request || !['data-only','targeted-fix','guard-repair'].includes(scope.mode)
      || !scope.rules || !Array.isArray(scope.patches)) throw new Error('Invalid work order')
  for (const path of ['AGENTS.md','CLAUDE.md','VIECGANBAN_STRUCTURE_BASELINE.md'])
    if (!/^[0-9a-f]{64}$/.test(scope.rules[path] || '')) throw new Error(`Missing rule revision: ${path}`)
  if (scope.mode === 'data-only' && scope.patches.some(p => /\.(tsx|css)$/.test(p.path)))
    throw new Error('Data-only work cannot authorize template/CSS edits')
  for (const p of scope.patches) {
    if (typeof p.path !== 'string' || !/^[A-Za-z0-9_.\/-]+$/.test(p.path) || p.path.startsWith('/') || p.path.split('/').includes('..'))
      throw new Error('Exact repository paths required; no wildcards/traversal')
    if (!['replace','create','delete'].includes(p.kind)) throw new Error('Explicit patch operation required')
    if (p.kind === 'replace' && (typeof p.before !== 'string' || !p.before || typeof p.after !== 'string')) throw new Error('Exact before/after region required')
    if (p.kind === 'create' && typeof p.after !== 'string') throw new Error('Exact new content required')
    if (p.kind === 'delete' && !/^[0-9a-f]{64}$/.test(p.before_sha256 || '')) throw new Error('Exact deletion baseline required')
  }
}

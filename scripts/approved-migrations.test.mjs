import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isApprovedMigration, approvedCandidatePaths } from './approved-migrations.mjs'
import { evaluateFiles } from './check-repository-policy.mjs'
const path = 'supabase/migrations/20261027000000_location_single_source.sql'
const source = Buffer.from('DELETE FROM example;\nDROP POLICY old ON example;\n')
const manifest = { approvals: [{ path, sha256: createHash('sha256').update(source).digest('hex') }] }
test('approval requires exact path and raw bytes', () => {
  assert.equal(isApprovedMigration(path, source, manifest), true)
  assert.equal(isApprovedMigration(path, Buffer.concat([source, Buffer.from('\n')]), manifest), false)
  assert.equal(isApprovedMigration(path.replace('000000_', '000001_'), source, manifest), false)
  assert.equal(isApprovedMigration(path, source, { approvals: [] }), false)
  assert.equal(isApprovedMigration(path, source.toString(), manifest), false)
})
test('policy exception applies only to verified approved content', () => {
  const patches = { [path]: '+DELETE FROM example;\n+DROP POLICY old ON example;' }
  assert.equal(evaluateFiles([path], '', patches).length, 1)
  assert.equal(evaluateFiles([path], '', patches, { approvedMigrations: new Set([path]) }).length, 0)
  const other = path.replace('single_source', 'other')
  assert.equal(evaluateFiles([path, other], '', { ...patches, [other]: '+DELETE FROM example;' }, { approvedMigrations: new Set([path]) }).length, 1)
})
test('all unapproved destructive SQL classes remain blocked', () => {
  for (const sql of ['DROP TABLE t;', 'DROP COLUMN c;', 'DROP SCHEMA x;', 'DROP POLICY p ON t;', 'TRUNCATE t;', 'DELETE FROM t;', 'ALTER TABLE t DROP COLUMN c;']) {
    assert.equal(evaluateFiles([path], '', { [path]: '+' + sql }).length, 1, sql)
  }
  assert.equal(evaluateFiles(['STATUS.md'], '', {}, { approvedMigrations: new Set([path]) }).length, 1)
  assert.equal(isApprovedMigration('../' + path, source, manifest), false)
  assert.equal(isApprovedMigration(path, Buffer.from(source.toString().replaceAll('\n', '\r\n')), manifest), false)
})

test('bot verifier hashes API blobs as data and refuses changed/deleted candidates', () => {
  const file = { filename: path, sha: 'a'.repeat(40), status: 'added' }
  let fetches = 0
  const load = sha => {
    assert.equal(sha, file.sha)
    fetches++
    return { encoding: 'base64', content: source.toString('base64') }
  }
  assert.deepEqual(approvedCandidatePaths([file], manifest, load), [path])
  assert.equal(fetches, 1)
  for (const status of ['modified', 'removed', 'renamed'])
    assert.deepEqual(approvedCandidatePaths([{ ...file, status }], manifest, load), [])
  assert.deepEqual(approvedCandidatePaths([{ ...file, sha: '../bad' }], manifest, load), [])
  assert.deepEqual(approvedCandidatePaths([{ ...file, filename: 'other.sql' }], manifest, load), [])
  assert.equal(fetches, 1)
  assert.deepEqual(approvedCandidatePaths([file], manifest, () => ({ encoding: 'base64', content: Buffer.from('tampered').toString('base64') })), [])
  assert.throws(() => approvedCandidatePaths([file], manifest, () => ({ encoding: 'utf8', content: source })), /encoding/)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const [profilePage, cvBuilder, storage, cvStorage, migrationStorage] = await Promise.all([
  read('src/pages/Profile.tsx'),
  read('src/components/CvBuilder.tsx'),
  read('src/lib/storage.ts'),
  read('src/lib/cvStorage.ts'),
  read('src/lib/accountMigrationStorage.ts'),
])

for (const pattern of [
  /loadAccountProfile/,
  /saveAccountProfile/,
  /user\?\.id/,
  /saveProfile\(profile, user\.id\)/,
  /if \(!user\)[\s\S]+saveProfile\(profile\)/,
  /profileServerError/,
  /shouldOfferLocalImport/,
  /markLocalImportDecision/,
  /Nhập dữ liệu trên thiết bị này/,
]) {
  assert.match(profilePage, pattern, `Profile account sync is missing ${pattern}`)
}

for (const pattern of [
  /userId\?: string/,
  /loadAccountCv/,
  /saveAccountCv/,
  /uploadCvPhoto/,
  /loadCvPhoto/,
  /saveCv\(data, userId\)/,
  /serverError/,
]) {
  assert.match(cvBuilder, pattern, `CvBuilder account sync is missing ${pattern}`)
}

assert.match(storage, /export function hasStoredProfile\(scope\?: string\)/)
assert.match(cvStorage, /export function hasStoredCv\(scope\?: string\)/)
assert.doesNotMatch(storage, /removeItem\(PROFILE_KEY\)/)
assert.doesNotMatch(cvStorage, /removeItem\(CV_KEY\)/)

for (const pattern of [
  /vgb_account_import:/,
  /export function shouldOfferLocalImport/,
  /export function markLocalImportDecision/,
  /userId/,
  /accepted.*declined/s,
]) {
  assert.match(migrationStorage, pattern, `Migration storage is missing ${pattern}`)
}

console.log('profile account sync contracts: PASS')

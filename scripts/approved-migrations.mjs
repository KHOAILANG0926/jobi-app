// Approval is for exact raw source bytes, never SQL patterns or PR body claims.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export const MANIFEST_PATH = '.github/approved-migrations.json'
export function isApprovedMigration(path, source, manifest) {
  if (!/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(path) || !Buffer.isBuffer(source)) return false
  const approval = manifest?.approvals?.find(item => item.path === path)
  return !!approval && /^[a-f0-9]{64}$/.test(approval.sha256) &&
    createHash('sha256').update(source).digest('hex') === approval.sha256
}

export function approvedCandidatePaths(files, manifest, loadBlob) {
  const approved = []
  for (const file of files) {
    if (!manifest.approvals.some(item => item.path === file.filename)) continue
    // A deleted/renamed file cannot spend an approval for a new migration.
    if (file.status !== 'added' || !/^[a-f0-9]{40}$/.test(file.sha)) continue
    const blob = loadBlob(file.sha)
    if (blob.encoding !== 'base64') throw new Error('Unexpected migration blob encoding')
    if (isApprovedMigration(file.filename, Buffer.from(blob.content, 'base64'), manifest)) approved.push(file.filename)
  }
  return approved
}

// This CLI runs only from the bot's trusted master checkout. Candidate blobs are
// fetched as API JSON data and decoded as bytes; no candidate source is executed.
if (process.argv[1]?.endsWith('/approved-migrations.mjs')) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const files = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const approved = approvedCandidatePaths(files, manifest, sha =>
    JSON.parse(execFileSync('gh', ['api', `repos/${process.env.REPO}/git/blobs/${sha}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })))
  console.log(JSON.stringify(approved))
}

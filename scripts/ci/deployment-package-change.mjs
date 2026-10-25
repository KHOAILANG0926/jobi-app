import {isDeepStrictEqual} from 'node:util'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'

// Narrow exception: adding pg for operations tests. Existing packages, including
// Vite/TypeScript and all runtime dependencies, must remain byte-for-byte equivalent.
export function onlyAddedTestPg(before, after) {
  const next=structuredClone(after)
  if(before.manifest.devDependencies?.pg || !next.manifest.devDependencies?.pg) return false
  delete next.manifest.devDependencies.pg
  delete next.lock.packages[''].devDependencies.pg
  for(const [name,pkg] of Object.entries(next.lock.packages)) {
    if(!(name in before.lock.packages)) {
      if(pkg.dev!==true) return false
      delete next.lock.packages[name]
    }
  }
  return isDeepStrictEqual(before,next)
}
if(import.meta.url===pathToFileURL(process.argv[1]).href) {
  const read=ref=>Object.fromEntries([['manifest','package.json'],['lock','package-lock.json']].map(([key,file])=>
    [key,JSON.parse(execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}))]))
  try { process.exit(onlyAddedTestPg(read(process.argv[2]),read('HEAD'))?0:1) }
  catch { process.exit(1) } // Unknown comparison always requires deployment.
}

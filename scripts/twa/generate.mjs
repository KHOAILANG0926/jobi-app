// Generates the Android TWA project from android/twa-manifest.json (Bubblewrap core, non-interactive).
// Runs only in GitHub Actions (android-twa-build.yml). No keys are read here.
import { readFileSync } from 'node:fs'
import { TwaGenerator, TwaManifest, ConsoleLog } from '@bubblewrap/core'

const target = process.argv[2] || 'android/project'
const json = JSON.parse(readFileSync('android/twa-manifest.json', 'utf8'))
if (process.env.APP_VERSION_CODE) json.appVersionCode = Number(process.env.APP_VERSION_CODE)
if (process.env.APP_VERSION_NAME) json.appVersionName = process.env.APP_VERSION_NAME
const manifest = new TwaManifest(json)
const error = manifest.validate()
if (error) { console.error(`::error::twa-manifest invalid: ${error}`); process.exit(1) }
await new TwaGenerator().createTwaProject(target, manifest, new ConsoleLog('twa'))
console.log(`TWA project generated at ${target} (package ${json.packageId}, version ${json.appVersionCode}/${json.appVersionName})`)

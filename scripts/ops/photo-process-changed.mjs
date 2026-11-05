import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
export function changedPhotoPayloads(event) {
  const pr=event.pull_request
  if (!pr) return []
  const files=execFileSync('git',['diff','--name-only',pr.base.sha,pr.head.sha,'--','scripts/ops/jobs/'],{encoding:'utf8'}).trim().split('\n')
  return files.filter(path=>path.endsWith('.json')&&existsSync(path)).map(path=>({path,payload:JSON.parse(readFileSync(path,'utf8'))})).filter(x=>x.payload.company&&x.payload.source_text)
}

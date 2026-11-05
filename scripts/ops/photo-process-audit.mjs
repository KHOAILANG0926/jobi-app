// Source-file inventory, not a claim about live images. Existing postings stay public.
import { readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { photoProcessPlan } from './photo-process.mjs'
const rows=[]
for (const file of readdirSync('scripts/ops/jobs').filter(f=>f.endsWith('.json'))) {
  const payload=JSON.parse(readFileSync(`scripts/ops/jobs/${file}`,'utf8'))
  if (!payload.company || !payload.source_text) continue
  rows.push({file,company:payload.company,...photoProcessPlan(payload)})
}
const out=process.argv[2] || '/tmp/jobi-photo-process-pending.json'
writeFileSync(out,JSON.stringify({kind:'source_inventory_not_live_verification',complete:false,rows},null,2)+'\n')
const message=`사진 처리 원본 기록 ${rows.length}건 점검. 이 목록은 운영 사진 검증이 아니며 완료 증거로 사용할 수 없습니다. 재처리 단계는 ${out} 참고.`
console.log(message)
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### 사진 처리 미완료 목록\n${message}\n`)

// Runs inside the required PR screen check. A completion claim must execute the
// live check; a disclosed pending photo does not block job registration.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { changedPhotoPayloads } from './photo-process-changed.mjs'
import { photoProcessPrProblems } from './photo-process-pr.mjs'
import { photoProcessPlan } from './photo-process.mjs'
import { runPhotoVerification } from './photo-process-verify.mjs'
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'))
const payloads=changedPhotoPayloads(event),body=event.pull_request?.body??''
const problems=photoProcessPrProblems(body,payloads)
if (problems.length) throw new Error(problems.join('\n'))
const out=process.env.PHOTO_PROOF_DIR||'photo-process-proof'
mkdirSync(out,{recursive:true})
const results=[]
let browser
try {
  if(payloads.length && /^- 사진 처리:\s*완료/m.test(body)) {
    const {chromium}=await import('playwright')
    browser=await chromium.launch({args:['--no-sandbox']})
  }
  for(const item of payloads) {
    const result=browser?await runPhotoVerification(item.payload,{detailUrl:item.payload.logo_check.detail_url,browser,proofDir:`${out}/${basename(item.path,'.json')}`}):photoProcessPlan(item.payload)
    results.push({file:item.path,...result})
    if(browser&&!result.complete)process.exitCode=1
    if(!result.complete)console.log(`::warning::${item.path}: 사진 처리 미완료 (${result.stage})`)
  }
} finally {await browser?.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2)+'\n')}
console.log(`사진 처리 완료 주장 ${browser?'운영 검증 실행':'없음'}, 대상 ${payloads.length}건. CI/등록 성공을 사진 완료로 간주하지 않음.`)

import cases from '../../policy/cases.json' with { type: 'json' }
import { evaluateJobPolicy, assertJobPolicy, assertJobChange } from '../../policy/job-posting.mjs'
import { isPublicJobAllowed } from './jobQualityFilter.ts'
import type { Job } from '../types/job.ts'
for (const c of cases) {
  const actual = evaluateJobPolicy(c.job)
  if (actual.decision !== c.decision) throw new Error(`${c.name}: ${actual.decision} != ${c.decision}`)
  let blocked = false
  try { assertJobPolicy(c.job) } catch { blocked = true }
  if (blocked !== (c.decision !== 'allow')) throw new Error(`${c.name}: publication gate`)
}
if (evaluateJobPolicy(null).decision !== 'review') throw new Error('invalid input must fail closed')
const current = {title:'QC', description:'Kiểm tra chất lượng'}
for (const patch of [{title:'Sales B2B'}, {description:''}, {title:'Tư vấn tín dụng'}]) {
  let blocked = false
  try { assertJobChange(current, patch) } catch { blocked = true }
  if (!blocked) throw new Error('edit must re-evaluate final content')
}
assertJobChange(current, {title:undefined, salary:'30.000.000 VND'})
const legacy = {title:'Sales', description:'Chưa rõ nhiệm vụ'}
if (!isPublicJobAllowed({...legacy,company:''} as Job)) throw new Error('new policy must not retrospectively remove legacy public rows')
if (!isPublicJobAllowed({title:'QC Home Credit',company:'Home Credit',description:'Kiểm tra chất lượng'} as Job)) throw new Error('allowed normal role must remain visible despite finance company name')
if (isPublicJobAllowed({title:'Loan officer',company:'',description:'Loan sales'} as Job)) throw new Error('dedicated loan role must remain blocked')
assertJobChange(legacy, {salary:'25.000.000 VND', urgent:true})
assertJobChange(legacy, {title:'Sales',description:'Chưa rõ nhiệm vụ'})
assertJobChange(legacy, {active:false})
assertJobChange(legacy, {admin_hidden:true})
let reopeningBlocked = false
try { assertJobChange(legacy, {}, true) } catch { reopeningBlocked = true }
if (!reopeningBlocked) throw new Error('explicit republish must recheck unchanged content')
let failedClosed = false
try { assertJobChange(null) } catch { failedClosed = true }
if (!failedClosed) throw new Error('unreadable current row must block republish')
console.log(`job policy: ${cases.length} shared cases passed`)

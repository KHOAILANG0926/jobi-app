import cases from '../../policy/cases.json' with { type: 'json' }
import { evaluateJobPolicy, assertJobPolicy, assertJobChange } from '../../policy/job-posting.mjs'
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
let failedClosed = false
try { assertJobChange(null) } catch { failedClosed = true }
if (!failedClosed) throw new Error('unreadable current row must block republish')
console.log(`job policy: ${cases.length} shared cases passed`)

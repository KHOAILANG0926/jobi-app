// Real handler with the DB boundary enforcing the live R7 rule: service_role
// cannot modify ocr_check. Section choices must enqueue regeneration separately.
import assert from 'node:assert/strict'
import {mock} from 'node:test'

const line='E2E original line'
const writes:{table:string;value:unknown}[]=[]
const service={from(table:string) {
  return {
    select() {return this},
    eq() {return this},
    async maybeSingle() {return {data:table==='local_jobs'
      ? {id:123,source_text:line,ocr_check:{detail_fill:{unclassified:[line]}}}
      : null,error:null}},
    async upsert(value:unknown) {writes.push({table,value});return {error:null}},
    update() {return {async eq() {return {error:{message:'job_rule_R7: ocr_text/ocr_check는 기계만 쓸 수 있음'}}}}},
  }
}}
mock.module('@supabase/supabase-js',{namedExports:{createClient:()=>service}})
const {createAdminUsersHandler}=await import('./_lib/admin-users.js')
const request={method:'POST',url:'/api/admin?action=users&operation=line-picks',
  headers:{authorization:'Bearer unit-test-session'},body:{action:'line-pick',jobId:123,line,code:'02'}}
function response() {
  return {statusCode:0,body:null as unknown,status(code:number){this.statusCode=code;return this},json(value:unknown){this.body=value;return this}}
}
const res=response()
await createAdminUsersHandler({verifyCaller:async()=>({app_metadata:{role:'admin'}})})(request,res)
assert.equal(res.statusCode,200,JSON.stringify(res.body))
assert.deepEqual(writes.map(x=>x.table),['detail_line_kinds','job_signal_queue'])
assert.deepEqual(writes[0].value,{line_key:'e2e original line',section:'02',example:line,decided_by:'lee'})
assert.equal((writes[1].value as {workflow:string}).workflow,'job-ocr-check.yml')
assert.equal((res.body as {rebuild_required:boolean}).rebuild_required,true)
const forbidden=response()
await createAdminUsersHandler({verifyCaller:async()=>({app_metadata:{role:'seeker'}})})(request,forbidden)
assert.equal(forbidden.statusCode,403)
assert.equal(writes.length,2,'non-admin must not write choices or signals')
console.log('admin line picks: section choice queues rebuild under R7; non-admin denied')

// 중복 의심 게시판(Lee 2026-11-07): 같은 「분류 못 한 줄 고르기」 API가 의심 공고를 돌려주고, 결정은 DB 함수 하나로만 쓴다.
import assert from 'node:assert/strict'
import {mock} from 'node:test'

const rpcCalls:{fn:string;args:unknown}[]=[]
const rows:Record<string,unknown[]>={
  suspect:[{id:20,title:'Hojeong mới',company:'Hojeong',duplicate_of:10,duplicate_reason:'job_unclear'}],
  others:[{id:10,title:'Hojeong cũ',company:'Công ty TNHH Hojeong'}],
}
function query(table:string) {
  let mode=''
  const q={
    select() {return q}, order() {return q}, limit() {return q},
    in() {mode='others';return q},
    eq(col:string,val:unknown) {if(col==='duplicate_status'&&val==='suspect')mode='suspect';return q},
    then(resolve:(v:unknown)=>void) {
      if(table==='detail_line_kinds')return resolve({data:[],error:null})
      if(mode==='suspect')return resolve({data:rows.suspect,error:null})
      if(mode==='others')return resolve({data:rows.others,error:null})
      return resolve({data:[],error:null})
    },
  }
  return q
}
const service={from:(t:string)=>query(t),async rpc(fn:string,args:unknown){rpcCalls.push({fn,args});return {data:'cleared',error:null}}}
mock.module('@supabase/supabase-js',{namedExports:{createClient:()=>service}})
const {createAdminUsersHandler}=await import('./_lib/admin-users.js')
const res=()=>({statusCode:0,body:null as unknown,status(c:number){this.statusCode=c;return this},json(v:unknown){this.body=v;return this}})
const admin={verifyCaller:async()=>({app_metadata:{role:'admin'}})}

const g=res()
await createAdminUsersHandler(admin)({method:'GET',url:'/api/admin?action=users&operation=line-picks',headers:{authorization:'Bearer t'}},g)
assert.equal(g.statusCode,200,JSON.stringify(g.body))
assert.deepEqual((g.body as {duplicates:unknown[]}).duplicates,[{jobId:20,title:'Hojeong mới',company:'Hojeong',reason:'job_unclear',
  other:{jobId:10,title:'Hojeong cũ',company:'Công ty TNHH Hojeong'}}])

const p=res()
await createAdminUsersHandler(admin)({method:'POST',url:'/api/admin?action=users',headers:{authorization:'Bearer t'},body:{action:'duplicate-decision',jobId:20,decision:'not_duplicate'}},p)
assert.equal(p.statusCode,200,JSON.stringify(p.body))
assert.deepEqual(rpcCalls,[{fn:'job_duplicate_decide',args:{p_job:20,p_decision:'not_duplicate'}}])

const bad=res()
await createAdminUsersHandler(admin)({method:'POST',url:'/api/admin?action=users',headers:{authorization:'Bearer t'},body:{action:'duplicate-decision',jobId:20,decision:'publish_all'}},bad)
assert.equal(bad.statusCode,400)
const seeker=res()
await createAdminUsersHandler({verifyCaller:async()=>({app_metadata:{role:'seeker'}})})({method:'POST',url:'/api/admin?action=users',headers:{authorization:'Bearer t'},body:{action:'duplicate-decision',jobId:20,decision:'duplicate'}},seeker)
assert.equal(seeker.statusCode,403)
assert.equal(rpcCalls.length,1,'관리자 아니면 결정 못 함')
console.log('admin duplicates: 의심 목록·결정은 DB 함수 하나·관리자만 통과')

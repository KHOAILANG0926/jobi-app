const assert = {
  equal(actual: unknown, expected: unknown) { if (actual !== expected) throw new Error('Expected ' + String(expected) + ', got ' + String(actual)) },
  deepEqual(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Objects differ') },
  throws(action: () => unknown) { let threw = false; try { action() } catch { threw = true }; if (!threw) throw new Error('Expected rejection') },
}
import { parseAdminJobDraft, adminSavedJob } from './adminJobDraft'
const draft = parseAdminJobDraft(JSON.stringify({title:'Công nhân',company:'KDA',category:'factory',employerPhone:'0877880756',lat:null,lng:null,active:true,adminHidden:false}), ['factory'])
assert.equal(draft.employerPhone,'0877880756')
assert.equal('active' in draft,false)
assert.equal('adminHidden' in draft,false)
assert.throws(()=>parseAdminJobDraft('{"title":"x","company":"y","category":"invalid"}',['factory']))
assert.throws(()=>parseAdminJobDraft('{"title":"x","company":"y","lat":100}',['factory']))
assert.throws(()=>parseAdminJobDraft('{"title":"x","company":"y","urgent":"true"}',['factory']))
assert.throws(()=>adminSavedJob(null))
assert.throws(()=>adminSavedJob({id:1,active:true}))
assert.deepEqual(adminSavedJob({id:123,active:false,admin_hidden:true}),{id:123,isPublic:false,href:'/viec-lam/sb-123'})
assert.equal(adminSavedJob({id:124,active:true,admin_hidden:false}).isPublic,true)
console.log('adminJobDraft: all assertions passed')

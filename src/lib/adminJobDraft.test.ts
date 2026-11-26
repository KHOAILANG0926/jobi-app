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

// #701 D(2026-11-26): 관리자 원문 자동 채우기는 공통 판독기로만 — 브라우저 AI 호출 없음, 원문에 없는 값은 빈칸.
{
  const { readAdminPost } = await import('./adminJobDraft')
  const { readCompany } = await import('./companyReader')
  const { readAddress } = await import('./addressReader')
  const { readSalary } = await import('./salaryReader')
  const text = 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong\nCông ty TNHH KDA\nĐịa chỉ: Lô A1, KCN Yên Phong, Bắc Ninh\nLương: 8.000.000đ/tháng\nLH: 0877 880 756'
  const r = readAdminPost(text)
  assert.equal(r.title, 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong')
  assert.equal(r.company, readCompany(text).name)
  assert.equal(r.location, readAddress(text))
  assert.equal(r.salary, readSalary(text)?.salary ?? '')
  assert.equal(r.employerPhone, '0877880756')
  assert.equal(r.occupationCode, '82022')
  assert.equal(r.occupationEvidence, 'làm linh kiện tai nghe')
  assert.equal(text.includes(String(r.occupationEvidence)), true)
  const empty = readAdminPost('Tuyển gấp, lương cao')
  assert.equal(empty.employerPhone, '')
  assert.equal('occupationCode' in empty, false)
  const fsModule = 'node:fs'
  const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: URL, enc: string) => string }
  const page = readFileSync(new URL('../pages/AdminDashboard.tsx', import.meta.url), 'utf8')
  assert.equal(page.includes('api.anthropic.com'), false)
}

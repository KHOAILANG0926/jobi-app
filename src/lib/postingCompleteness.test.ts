import { inspectJob, publishDecision } from './jobInspect.ts'
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message) }
const base = { id: 900001, company: 'Example', title: 'Trợ lý nhân sự', salary: '18 triệu/tháng', description: 'Công việc\nQuản lý hồ sơ nhân sự.', phones: ['0787486194'], addresses: ['Bắc Ninh'], category: 'van_phong', occupation_code: '4406', pin: 'area', active: true }
const incomplete = inspectJob({ ...base, postingFields: { hours: '', employment_type: null, application_deadline: '', num_hires: '2' } })
const check = incomplete.items.find(i => i.key === 'required_fields')
assert(check && !check.ok, 'missing required posting fields must fail inspection')
assert(check?.detail?.includes('근무시간') && check?.detail?.includes('고용형태') && check?.detail?.includes('모집마감'), 'report each absent required value')
assert(!publishDecision(incomplete, { active: true, admin_hidden: false, hold: false }).publishable, 'failed required-field inspection must block publication')
const complete = inspectJob({ ...base, postingFields: { hours: '08:00–17:00', employment_type: 'full_time', application_deadline: '2026-12-31', num_hires: '2' } })
assert(complete.items.find(i => i.key === 'required_fields')?.ok, 'all nine existing required fields pass')
const notFullTime = inspectJob({ ...base, postingFields: { hours: '08:00–17:00', application_deadline: '2026-12-31', num_hires: '2' } })
assert(!notFullTime.items.find(i => i.key === 'required_fields')?.ok, 'monthly salary must never imply full-time employment')
console.log('postingCompleteness: mandatory fields, explicit employment and publication hold passed')

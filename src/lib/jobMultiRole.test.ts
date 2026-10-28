function assert(ok: unknown, message?: string): asserts ok { if (!ok) throw new Error(message ?? 'assertion failed') }
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { detailSections } from './jobDetailSections.ts'
import { inspectJob } from './jobInspect.ts'
import { BOMUNTTL_SOURCE as source, BOMUNTTL_CONTEXT as ctx } from './jobMultiRole.fixtures.ts'
const built = buildDescriptionFromSources([{name:'source_text',text:source}],ctx)
const view = detailSections(built.description,ctx)
const shown = view.sections.flatMap(s=>s.lines)
assert(shown.some(l=>l.includes('CÔ RỬA BÁT FULL TIME — Lương thỏa thuận + thưởng')), 'dishwasher salary retains role')
assert(shown.some(l=>l.includes('NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Mức lương: 30k-35k/ 1h')), 'waiter salary retains role')
assert(shown.some(l=>l.includes('CÔ RỬA BÁT FULL TIME — (tg: 10h - 10h)')), 'invalid original time unchanged')
assert(!shown.find(l=>l.includes('Được đào tạo'))?.includes('CHẠY BÀN'), 'shared benefits do not inherit the last role')
assert(!view.usedFallback)
assert(built.unclassified.length === 0, 'all poster line types have a common rule')
assert(view.sections.find(s=>s.key==='02')?.lines.some(l=>l.includes('CHẠY BÀN PART TIME — Yêu cầu:')), 'requirements remain attached to waiter')
assert(view.sections.find(s=>s.key==='05')?.lines.some(l=>l.includes('RỬA BÁT FULL TIME — Bao ăn 2 bữa')), 'two meals belong to dishwasher')
const report = inspectJob({id:0,...ctx,source_text:source,description:built.description,category:'am_thuc_do_uong',occupation_code:'9402',meal_provided:null,active:true,pin:null,unlocated_reason:'awaiting administrator',unclassified_lines:built.unclassified.map(l=>l.line)})
assert(!report.ok)
assert(JSON.stringify(report.items.filter(i=>!i.ok).map(i=>i.key).sort()) === JSON.stringify(['hours_review','pin']), 'only actual unresolved time and location remain')
assert(report.items.find(i=>i.key==='benefits')?.ok, 'role-specific meals must not require a global meal promise')
assert(report.items.some(i=>i.key==='hours_review'&&!i.ok))
assert(report.items.some(i=>i.key==='pin'&&!i.ok))
// Repeated conditions for separate roles must not be deduplicated across roles.
const other = buildDescriptionFromSources([{name:'source_text',text:'BẾP FULL TIME\nLương thỏa thuận\nSẢNH PART TIME\nLương thỏa thuận\nQUYỀN LỢI:\nĐược đào tạo'}])
assert(other.description.includes('BẾP FULL TIME — Lương thỏa thuận'))
assert(other.description.includes('SẢNH PART TIME — Lương thỏa thuận'))
console.log('jobMultiRole: role conditions, shared benefits and unresolved checklist retained')

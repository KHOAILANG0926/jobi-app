import { buildDescriptionFromSources, cleanSourceText } from './jobDescriptionBuild.ts'
import { detailSections } from './jobDetailSections.ts'
import { descriptionRoleGroups, roleScopedMeals, roleConditionSummary } from './jobRolePresentation.ts'
import { BOMUNTTL_SOURCE, BOMUNTTL_CONTEXT } from './jobMultiRole.fixtures.ts'
function assert(ok: unknown, msg: string): asserts ok { if (!ok) throw new Error(msg) }
const merged = cleanSourceText('Mức lương: 30k-35k/ 1h\n+ thưởng + tip').text
assert(merged === 'Mức lương: 30k-35k/ 1h + thưởng + tip', 'salary continuation joined without rewriting')
const built = buildDescriptionFromSources([{name:'source_text',text:BOMUNTTL_SOURCE}],BOMUNTTL_CONTEXT)
const sections = detailSections(built.description,BOMUNTTL_CONTEXT).sections
assert(sections.find(s=>s.key==='07')?.lines.some(l=>l.startsWith('Gia nhập đội ngũ')), 'join-team call is supplementary information')
assert(sections.find(s=>s.key==='07')?.lines.some(l=>l.startsWith('Ứng tuyển sớm')), 'urgency call is supplementary information')
const view=descriptionRoleGroups(sections)
const salaries=view.find(s=>s.key==='04')!
assert(salaries.groups.length===2, 'two role groups in salary section')
assert(salaries.groups.every(g=>g.role && g.lines.every(l=>!l.startsWith(g.role!))), 'role heading once per group, no repeated line prefixes')
assert(salaries.groups.some(g=>g.lines.includes('Mức lương: 30k-35k/ 1h + thưởng + tip')), 'whole waiter wage retained')
// Legacy persisted descriptions must improve without changing one job's stored row.
const legacy=descriptionRoleGroups([
 {key:'04',label:'Thu nhập',lines:['BẾP FULL TIME — Lương: 35k/1h','SẢNH PART TIME — Lương: 30k/1h']},
 {key:'07',label:'Thông tin khác',lines:['SẢNH PART TIME — + thưởng + tip','BẾP FULL TIME — Không cần kinh nghiệm']},
])
assert(legacy.find(s=>s.key==='04')?.groups.find(g=>g.role==='SẢNH PART TIME')?.lines[0]==='Lương: 30k/1h + thưởng + tip', 'legacy fragment rejoins same role salary across old section boundary')
assert(!legacy.find(s=>s.key==='07')?.groups.some(g=>g.role==='SẢNH PART TIME'), 'consumed fragment leaves no empty role heading')
assert(legacy.find(s=>s.key==='07')?.groups.find(g=>g.role==='BẾP FULL TIME')?.lines[0]==='Không cần kinh nghiệm', 'other role conditions remain intact')
const single=descriptionRoleGroups([{key:'04',label:'Thu nhập',lines:['310k/11h','Chuyên cần 50k/tuần']}])
assert(single[0].groups.length===1 && !single[0].groups[0].role, 'single-role KDA presentation unchanged')
console.log('jobRolePresentation: grouped roles, promotions, continuation and legacy fixtures pass')

assert(roleScopedMeals(built.description).length === 1, 'two meals belong to only one role')
assert(roleScopedMeals('CÔ RỬA BÁT FULL TIME\nNHÂN VIÊN CHẠY BÀN PART TIME\nBao ăn 2 bữa').length === 0, 'shared meal line must not be reclassified as exclusive')

const summary=roleConditionSummary(built.description)
assert(summary?.salary==='Theo từng vị trí (2 vị trí) — xem chi tiết', 'approved salary summary, no invented numeric range')
assert(summary?.hours==='Khác nhau theo 2 vị trí — xem chi tiết', 'approved hours summary')
assert(summary?.workPeriod==='Full time / Part time', 'both documented employment types')
assert(summary?.workDays==='Rửa bát: nghỉ 4 ngày/tháng; chạy bàn: chưa nêu', 'holiday conditions do not spread to waiter')
assert(summary?.numHires==='2 vị trí; số người chưa nêu', 'roles are not headcount')
assert(summary?.mealBenefit==='Ăn ca: chỉ rửa bát, 2 bữa', 'approved scoped benefit text')
assert(roleConditionSummary('Công việc\nLàm linh kiện tai nghe')===null, 'ordinary KDA unaffected')
assert(roleScopedMeals('BẾP FULL TIME\nSẢNH PART TIME\nBẾP FULL TIME — Không bao ăn').length===0, 'negated role meals must not become a benefit promise')
const noWageContinuation=cleanSourceText('Tháng nghỉ 4 ngày\n+ thưởng + tip').text
assert(noWageContinuation==='Tháng nghỉ 4 ngày\n+ thưởng + tip', 'continuation cannot attach to a non-wage condition just because it has a number')

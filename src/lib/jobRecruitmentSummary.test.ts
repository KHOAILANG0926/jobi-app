import { rowToJob, EMPLOYER_JOBS_SELECT_COLUMNS } from './jobRows.ts'
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message) }
const source = { age_max: 30, num_hires: 2, description: '[source:facebook] Yêu cầu:\n• Không quá 30 tuổi.\n• Có kinh nghiệm làm nhân sự, nắm vững quy trình cơ bản.\n• Giao tiếp tiếng Trung lưu loát.\nỨng viên vui lòng gửi CV để được trao đổi chi tiết!' }
const job = rowToJob({ ...source, num_hires: String(source.num_hires), id: 900001 })
assert(job.ageRequirement === 'Không quá 30 tuổi.', 'source age sentence must reach the recruitment summary')
assert(job.rawPreference === 'Có kinh nghiệm làm nhân sự, nắm vững quy trình cơ bản.', 'experience without a numeric year must reach summary verbatim')
assert(job.languageRequirement === 'Giao tiếp tiếng Trung lưu loát.', 'source language must reach summary verbatim')
assert(job.requiredDocuments === 'Ứng viên vui lòng gửi CV để được trao đổi chi tiết!', 'CV instruction must reach summary verbatim')
assert(job.description === source.description.replace(/^\[source:facebook\]\s*/, ''), 'summary projection must preserve the entire lower description')
assert(EMPLOYER_JOBS_SELECT_COLUMNS.includes('age_min,age_max'), 'stored age bounds must be selected')
assert(rowToJob({ id: 900002, age_max: 30 }).ageRequirement === 'Không quá 30 tuổi', 'stored maximum age must work without another manual field')
assert(rowToJob({ id: 900003, age_min: 18, age_max: 30 }).ageRequirement === '18–30 tuổi', 'stored age range')
assert(rowToJob({ id: 900004, age_requirement: '18–45 tuổi', age_max: 30, description: source.description }).ageRequirement === '18–45 tuổi', 'explicit structured field takes precedence')
assert(rowToJob({ id: 900005, description: 'Không có yêu cầu khác.' }).requiredDocuments === undefined, 'missing data must not be invented')
assert(rowToJob({ id: 4824, description: source.description }).languageRequirement === undefined, 'approved legacy frame keeps its behavior')
console.log('jobRecruitmentSummary: source summary, stored bounds, precedence, missing data, legacy and lower content passed')

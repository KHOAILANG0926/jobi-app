import { CATEGORY_LABELS } from '../../data/categories'
import { activeBenefitText as activeBenefitTextOf, benefitFlags, type BenefitFlag, conditionSalaryLines as conditionSalaryLinesOf, employmentText as employmentTextOf, isAllowanceNote as isAllowanceNoteOf } from '../../lib/jobDetailDerive'
import { companyLine, detailTitle } from '../../lib/companyBranch'
import { conditionItems, itemsCoveredBy, salaryParts } from '../../lib/conditionLines'
import { balanceConditionColumns, detailSections, salaryAmounts, DETAIL_LABELS, sourceRecruitmentEligibility, type DetailSection, type DetailTextKey } from '../../lib/jobDetailSections'
import { deadlineBadge, JOB_TABS, SALARY_BASIS_LABEL, contactOf, jobTags, salaryPeriodLabel, shiftLabel, weekendLabel } from '../../lib/jobDetailView'
import { formatDeadlineVi } from '../../lib/jobUtils'
import { RECRUITMENT_LABELS } from '../../lib/jobConditions'
import { albamonCompose, albamonConditionLines, insuranceTags, sourceAgeValue, usesAlbamonLayout } from '../../lib/jobQuyenLoi'
import { roleConditionSummary, roleSalaryLines, roleSalaryRows, descriptionRoleGroups, type RoleSection } from '../../lib/jobRolePresentation'
import { recruitOrdered } from '../../lib/recruitColumns'
import { sourceRecruitmentRoles } from '../../lib/sourceRecruitmentRoles'
import { richPill } from '../../lib/detailRich'
import type { Job } from '../../types/job'

/** 공고 상세 4구역(① 근무조건 ② 모집조건 ③ 근무지역 ④ 상세요강)의 값 — pages/JobDetail.tsx가 만드는 값과 같은 lib 함수로 만든다.
 *  승인된 구성(상단 카드 + 4구역, 2026-10-30 확정)은 그대로이고, 여기서는 글자·줄만 만들고 모양은 화면(DetailScreen)이 그린다.
 *  원문이 채운 값만 행으로 만든다 — 없는 행은 숨기고 값을 지어내지 않는다. */
export interface DetailRow { key: string; label: string; text?: string; lines?: string[]; salary?: { period?: string; amount: string; rows?: { label: string; amount: string }[]; parts?: string[]; overtimeNote?: string; sub?: string[]; note?: string; basis?: string }; tone?: 'soon' }
export type DetailBenefit = BenefitFlag

export interface DetailModel {
  title: string
  company?: string
  categoryChip?: string
  chips: { text: string; tone?: 'urgent' | 'soon' | 'normal' | 'expired' }[]
  salaryHead?: { period?: string; amount: string; basis?: string; note?: string }
  benefits: DetailBenefit[]
  tags: string[]
  address?: string
  posted: string
  deadline: string
  conditionColumns: DetailRow[][]
  recruitRows: DetailRow[]
  sections: DetailSection[]
  roleSections: RoleSection[]
  rich?: { periodLabel?: string; salaryText?: string; overtimeNote?: string; pill?: string; insurance: string[]; phone?: string }
  tabs: { key: string; label: string; sectionId: string }[]
}

const nonEmpty = (v: string | null | undefined) => { const t = v?.trim(); return t ? t : undefined }

export function buildDetailModel(job: Job): DetailModel {
  const catLabel = CATEGORY_LABELS[job.category] ?? job.category
  const roleSummary = roleConditionSummary(job.description)
  const albamonLayout = usesAlbamonLayout(job.id)
  const salaryText = roleSummary?.salary ?? nonEmpty(job.rawSalary)
  const roleSalary = roleSummary ? roleSalaryLines(job.description) : []
  const salaryRows = roleSummary && albamonLayout ? roleSalaryRows(job.description) : []
  const conditionSalaryLines = conditionSalaryLinesOf(roleSalary)
  const locationText = nonEmpty(job.rawLocation)
  const preferenceText = nonEmpty(job.rawPreference)
  const educationText = nonEmpty(job.rawEducation)
  const numHiresText = nonEmpty(job.numHires) ?? roleSummary?.numHires
  const hoursText = roleSummary?.hours ?? nonEmpty(job.hours)
  const workDaysText = roleSummary?.workDays ?? nonEmpty(job.workDays)
  const deadlineText = formatDeadlineVi(job.applicationDeadline)
  const badge = deadlineBadge(job.applicationDeadline)
  const periodLabel = salaryPeriodLabel(job.salaryPeriod)
  const shownTitle = detailTitle(job.title, job.company)
  const detail = detailSections(job.description, albamonLayout ? {
    phones: [job.employerPhone, job.zalo],
    addresses: [job.rawLocation, ...(job.workLocations ?? []).map((l) => l.rawAddress)],
  } : {
    title: job.title, salary: job.salary,
    values: [job.ageRequirement, job.genderRequirement, educationText, preferenceText, numHiresText, job.languageRequirement, job.requiredDocuments],
    valueGroups: [[hoursText, workDaysText]],
    phones: [job.employerPhone, job.zalo],
    addresses: [job.rawLocation, ...(job.workLocations ?? []).map((l) => l.rawAddress)],
  })
  const albamonLines = albamonLayout && !roleSummary ? albamonConditionLines(detail.sections, job.salary) : { salary: [] as string[], insurance: [] as string[], overtimeNote: undefined as string | undefined }
  const compose = albamonLayout && !roleSummary ? albamonCompose(detail.sections, {
    title: job.title, company: job.company, salary: job.salary, hasHours: !!hoursText, preference: preferenceText,
    addresses: [job.rawLocation, job.location, ...(job.workLocations ?? []).map((l) => l.rawAddress)],
  }) : null
  const sourceRoles = sourceRecruitmentRoles(job.description)
  const sourceEligibility = sourceRecruitmentEligibility(job.description)
  const shift = shiftLabel(job)
  const weekend = weekendLabel(job.weekendWork)
  const employmentText = employmentTextOf(job, roleSummary, sourceRoles, nonEmpty(job.workPeriod))
  const salaryNote = nonEmpty(job.salaryNote)
  const isAllowanceNote = isAllowanceNoteOf(salaryNote)

  const benefits: DetailBenefit[] = benefitFlags(job, roleSummary)
  const activeBenefitText = activeBenefitTextOf(benefits)

  // 근무조건 칸(웹 ConditionLines): 한 항목 = 한 줄. 앱은 칸을 접지 않고 항목마다 한 줄로 모두 보여 준다.
  const condRow = (key: string, label: string, text: string | undefined): DetailRow | null => {
    if (!text) return null
    const items = conditionItems(text)
    return items.length ? { key, label, lines: items } : { key, label, text }
  }
  const textRow = (key: string, label: string, text: string | undefined): DetailRow | null => (text ? { key, label, text } : null)
  const linesRow = (key: string, label: string, lines: string[] | undefined): DetailRow | null => (lines?.length ? { key, label, lines } : null)
  const salaryRow: DetailRow | null = (salaryText || (salaryNote && !isAllowanceNote) || (!compose && albamonLines.salary.length)) ? {
    key: 'salary', label: 'Mức lương',
    salary: {
      period: salaryText ? periodLabel : undefined,
      amount: salaryText ?? '',
      rows: salaryText && salaryRows.length > 0 ? salaryRows : undefined,
      parts: salaryText && salaryRows.length === 0 ? (conditionSalaryLines.length ? conditionSalaryLines : salaryParts(salaryText)) : undefined,
      overtimeNote: salaryText && salaryRows.length === 0 ? albamonLines.overtimeNote : undefined,
      sub: !compose ? albamonLines.salary : undefined,
      basis: salaryText && job.salaryBasis ? SALARY_BASIS_LABEL[job.salaryBasis] : undefined,
      note: salaryNote && !isAllowanceNote ? salaryNote : undefined,
    },
  } : null
  const allowanceRow = !compose
    ? condRow('allowance', 'Phụ cấp · Thưởng', isAllowanceNote ? salaryNote : undefined)
    : linesRow('allowance', 'Phụ cấp · Thưởng', isAllowanceNote && salaryNote ? [salaryNote, ...compose.allowance.filter((l) => l.trim() !== salaryNote.trim())] : compose.allowance)
  const hoursRow = hoursText || !compose ? condRow('hours', 'Thời gian làm việc', hoursText) : linesRow('hours', 'Thời gian làm việc', compose.hours)
  const conditionFields: DetailRow[] = [
    salaryRow, allowanceRow, hoursRow,
    condRow('workDays', 'Ngày làm việc', workDaysText),
    condRow('workPeriod', 'Hình thức làm việc', employmentText),
    condRow('shift', 'Ca làm việc', shift),
    condRow('jobDuration', 'Thời hạn làm việc', nonEmpty(job.jobDuration)),
    condRow('weekend', 'Cuối tuần', weekend),
  ].filter((r): r is DetailRow => !!r)
  const conditionPcFields: DetailRow[] = [
    textRow('category', 'Ngành nghề', String(job.category) === 'other' ? undefined : catLabel),
    condRow('benefits', 'Phúc lợi', [activeBenefitText, ...(albamonLayout ? insuranceTags(albamonLines.insurance) : albamonLines.insurance)].filter(Boolean).join(' · ') || undefined),
  ].filter((r): r is DetailRow => !!r)
  const conditionKeys: readonly (readonly string[])[] = [['salary', 'allowance', 'jobDuration', 'workDays', 'hours'], ['category', 'workPeriod', 'shift', 'weekend', 'benefits']]
  // 웹은 PC 전용 행(Ngành nghề·Phúc lợi, 오른쪽 칸 균형용)을 휴대폰에서 숨긴다 — 앱은 휴대폰 화면이라 그 행을 빼고(Ngành nghề는 ② 칸에 있음) 같은 순서로 쓴다.
  const PC_ONLY = new Set(['category', 'benefits'])
  const conditionColumns = balanceConditionColumns(
    conditionKeys.map((keys) => keys.map((key) => [...conditionFields, ...conditionPcFields].find((f) => f.key === key)).filter((f): f is DetailRow => !!f)),
    albamonLayout).map((col) => col.filter((f) => !PC_ONLY.has(f.key)))

  const recruitFields: DetailRow[] = [
    textRow('roles', 'Vị trí tuyển dụng', !roleSummary && sourceRoles.roles.length ? sourceRoles.roles.join(' · ') : undefined),
    job.applicationDeadline ? { key: 'deadline', label: 'Hạn nộp hồ sơ', text: deadlineText + (badge ? ` (${badge.label})` : ''), tone: badge?.tone === 'soon' ? 'soon' as const : undefined } : null,
    textRow('numHires', 'Số lượng tuyển', numHiresText),
    textRow('education', 'Học vấn', educationText),
    textRow('preference', 'Kinh nghiệm', preferenceText ?? compose?.experience),
    linesRow('otherReq', 'Yêu cầu khác', compose?.otherRequirements),
    textRow('age', 'Độ tuổi', nonEmpty(job.ageRequirement) ?? (albamonLayout ? sourceAgeValue(detail.sections) : undefined)),
    textRow('sourceEligibility', 'Đối tượng tuyển', !nonEmpty(job.ageRequirement) || !nonEmpty(job.genderRequirement) ? sourceEligibility : undefined),
    textRow('gender', 'Giới tính', nonEmpty(job.genderRequirement)),
    textRow('docs', 'Hồ sơ cần chuẩn bị', job.requiredDocuments),
    textRow('language', 'Ngoại ngữ', job.languageRequirement),
    textRow('trip', 'Đi công tác', job.businessTrip === true ? 'Có thể đi công tác' : job.businessTrip === false ? 'Không đi công tác' : undefined),
    textRow('category', 'Ngành nghề', String(job.category) === 'other' ? undefined : catLabel),
  ].filter((r): r is DetailRow => !!r)

  // ④ 상세요강: 접힌 근무조건 칸 중 상세요강에 같은 내용이 없는 것은 해당 소제목에 원문 그대로 추가한다(JobDetail과 같은 규칙) — 앱은 접지 않으므로 추가분 없음.
  void conditionItems; void itemsCoveredBy
  const descriptionSections = [...(compose ? compose.detail : detail.sections)].sort((a, b) => a.key.localeCompare(b.key))
  const contact = contactOf(job)
  const sectionsForView: DetailSection[] = descriptionSections
  const chips: DetailModel['chips'] = []
  if (job.recruitmentType === 'agency') chips.push({ text: RECRUITMENT_LABELS.agency })
  if (job.urgent) chips.push({ text: 'Tuyển gấp', tone: 'urgent' })
  if (badge) chips.push({ text: badge.label, tone: badge.tone })
  return {
    title: shownTitle,
    company: companyLine(shownTitle, job.company),
    categoryChip: catLabel.toLowerCase() !== 'other' && catLabel.toLowerCase() !== 'khác' ? catLabel : undefined,
    chips,
    salaryHead: salaryText || job.salaryBasis ? { period: periodLabel, amount: salaryText ?? 'Thỏa thuận', basis: job.salaryBasis ? SALARY_BASIS_LABEL[job.salaryBasis] : undefined, note: nonEmpty(job.salaryNote) } : undefined,
    benefits,
    tags: jobTags(job).filter((t) => !['Xe đưa đón', 'Ký túc xá', 'Bao ăn'].includes(t)),
    address: locationText,
    posted: new Date(job.postedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    deadline: deadlineText,
    conditionColumns,
    recruitRows: recruitOrdered(recruitFields),
    sections: sectionsForView,
    roleSections: descriptionRoleGroups(sectionsForView),
    rich: compose ? { periodLabel, salaryText, overtimeNote: albamonLines.overtimeNote, pill: richPill(detail.sections.find((s) => s.key === '04')?.lines ?? [], salaryAmounts(job.salary), salaryAmounts), insurance: insuranceTags(albamonLines.insurance), phone: contact.phone } : undefined,
    tabs: JOB_TABS.filter((t) => t.key !== 'company').map((t) => ({ key: t.key, label: t.label, sectionId: 'app-sec-' + t.sections[0] })),
  }
}
export type { DetailTextKey }
export { DETAIL_LABELS }

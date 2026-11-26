// 공고 상세 값 만들기 중 웹(pages/JobDetail.tsx)과 앱(src/app/detail/detailModel.ts)이 똑같이 하던 계산(구조 정리 4번).
// 두 화면이 각자 같은 식을 갖고 있으면 한쪽만 고쳐 어긋나므로 한 곳에 둔다. 화면 코드(React·아이콘)는 없다 — 글자·참/거짓만 만든다.
// 동작은 JobDetail에 있던 식 그대로다(바꾸지 않음).
import { mealLabel } from './mealBenefit'
import { EMPLOYMENT_TYPE_EXTRA_LABEL, EMPLOYMENT_TYPE_LABEL } from './jobDetailView'
import type { Job } from '../types/job'

/** 근무조건 급여 칸: 직무별 급여 줄이 3줄을 넘으면 앞 2줄 + "세 번째 줄 +나머지 수". */
export function conditionSalaryLines(roleSalary: string[]): string[] {
  return roleSalary.length > 3 ? [...roleSalary.slice(0, 2), `${roleSalary[2]} +${roleSalary.length - 3}`] : roleSalary
}

/** 급여 메모가 수당·상여 설명이면 급여 칸이 아니라 수당 칸으로 보낸다(구조화된 급여·급여 메모만 보고 원문을 추정하지 않음). */
export function isAllowanceNote(salaryNote: string | undefined): boolean {
  return !!salaryNote && /(?:phụ cấp|phuc cap|thưởng|thuong|chuyên cần|chuyen can|trợ cấp|tro cap)/iu.test(salaryNote)
}

type RoleSummaryLike = { workPeriod?: string; mealBenefit?: string } | null | undefined
type SourceRolesLike = { workTypes: string[] }

/** "Hình thức làm việc" 칸의 글자: 직무 요약 → 원문 근무형태가 여럿이면 합침 → 구조화된 고용형태(+추가 형태) → 근무기간 글자 → 원문 첫 근무형태. */
export function employmentText(job: Job, roleSummary: RoleSummaryLike, sourceRoles: SourceRolesLike, workPeriodText: string | undefined): string | undefined {
  if (roleSummary?.workPeriod) return roleSummary.workPeriod
  if (sourceRoles.workTypes.length > 1) return sourceRoles.workTypes.join(' / ')
  if (job.employmentType) return [EMPLOYMENT_TYPE_LABEL[job.employmentType], job.employmentTypeExtra && EMPLOYMENT_TYPE_EXTRA_LABEL[job.employmentTypeExtra]].filter(Boolean).join(' · ')
  return workPeriodText ?? sourceRoles.workTypes[0]
}

export type BenefitKey = 'bus' | 'dorm' | 'meal' | 'attendance' | 'housing' | 'fuel' | 'performance'
export interface BenefitFlag { key: BenefitKey; label: string; active: boolean }

/** 상단 복리후생 7칸(확인된 것만 켠다 — 모르는 값은 "없음"이 아니라 꺼진 채로 둔다). AI가 원문 근거로 고른 benefit_tags 표시 이름도 켠다. */
export function benefitFlags(job: Job, roleSummary: RoleSummaryLike): BenefitFlag[] {
  const evidence = [job.description ?? '', ...(job.benefitTags ?? [])].join(' ').normalize('NFC')
  const aiTags = new Set(job.benefitTags ?? [])
  const explicit = (pattern: RegExp, label?: string) => (!!label && aiTags.has(label)) || pattern.test(evidence)
  return [
    { key: 'bus', label: 'Xe đưa đón', active: job.shuttleBus === true },
    { key: 'dorm', label: 'Ký túc xá', active: job.dormitory === true },
    { key: 'meal', label: roleSummary?.mealBenefit ?? mealLabel(job.description), active: !!roleSummary?.mealBenefit || job.mealProvided === true },
    { key: 'attendance', label: 'Chuyên cần', active: explicit(/(?:chuyên cần|chuyen can)(?:\s*[:：-]?\s*[\d.,]+\s*(?:k|đ|vnd|đồng))?/i, 'Chuyên cần') },
    { key: 'housing', label: 'Nhà ở', active: explicit(/(?:phụ cấp nhà ở|hỗ trợ nhà ở|tiền nhà|phu cap nha o|ho tro nha o)/i, 'Nhà ở') },
    { key: 'fuel', label: 'Xăng xe', active: explicit(/(?:phụ cấp xăng xe|hỗ trợ xăng xe|tiền xăng|phu cap xang xe|ho tro xang xe)/i, 'Xăng xe') },
    { key: 'performance', label: 'Năng suất', active: explicit(/(?:thưởng năng suất|thuong nang suat|thưởng sản lượng)/i, 'Năng suất') },
  ]
}

/** 켜진 복리후생 이름을 " · "로 이은 글자(근무조건 'Phúc lợi' 행). */
export const activeBenefitText = (flags: BenefitFlag[]): string => flags.filter((b) => b.active).map((b) => b.label).join(' · ')

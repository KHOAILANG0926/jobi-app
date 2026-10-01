// 공고 근무조건(근무 형태·통근/복지·채용 형태·모집 상태·근무 일정) 라벨과 표시 규칙 — 2026-10-01.
// null = 정보 미확인. 배지는 확인된 값(true 또는 명시된 선택지)만 보여주고, null을 "없음"으로 표시하지 않는다.
import type { Job, RecruitmentType, ShiftType, WorkSchedule } from '../types/job'

export const SHIFT_LABELS: Record<ShiftType, string> = {
  day: 'Ca ngày',
  night: 'Ca đêm',
  rotating: 'Xoay ca',
  other: 'Ca khác',
}

export const RECRUITMENT_LABELS: Record<RecruitmentType, string> = {
  direct: 'Tuyển trực tiếp',
  agency: 'Qua công ty cung ứng',
  unknown: 'Chưa rõ hình thức tuyển',
}

export const SCHEDULE_LABELS: Record<WorkSchedule, string> = {
  '5_days': '5 ngày/tuần',
  '6_days': '6 ngày/tuần',
  other: 'Lịch khác',
}

export type TriState = boolean | null

/** 등록/수정 폼이 다루는 근무조건 묶음 — Job의 같은 이름 필드와 1:1. */
export interface JobConditions {
  shiftType: ShiftType | null
  shuttleBus: TriState
  dormitory: TriState
  mealProvided: TriState
  recruitmentType: RecruitmentType | null
  immediateStart: TriState
  workSchedule: WorkSchedule | null
  weekendWork: TriState
}

export const EMPTY_CONDITIONS: JobConditions = {
  shiftType: null,
  shuttleBus: null,
  dormitory: null,
  mealProvided: null,
  recruitmentType: null,
  immediateStart: null,
  workSchedule: null,
  weekendWork: null,
}

export function conditionsFromJob(job: Partial<Job>): JobConditions {
  return {
    shiftType: job.shiftType ?? null,
    shuttleBus: job.shuttleBus ?? null,
    dormitory: job.dormitory ?? null,
    mealProvided: job.mealProvided ?? null,
    recruitmentType: job.recruitmentType ?? null,
    immediateStart: job.immediateStart ?? null,
    workSchedule: job.workSchedule ?? null,
    weekendWork: job.weekendWork ?? null,
  }
}

export interface ConditionBadge { key: string; label: string; tone: 'neutral' | 'good' | 'warn' }

/** 선택 공고 패널 등에서 보여줄 배지 — 확인된 값만. */
export function conditionBadges(job: Job): ConditionBadge[] {
  const out: ConditionBadge[] = []
  if (job.shiftType) out.push({ key: 'shift', label: SHIFT_LABELS[job.shiftType], tone: 'neutral' })
  if (job.shuttleBus === true) out.push({ key: 'bus', label: 'Xe đưa đón', tone: 'good' })
  if (job.dormitory === true) out.push({ key: 'dorm', label: 'Ký túc xá', tone: 'good' })
  if (job.mealProvided === true) out.push({ key: 'meal', label: 'Có bữa ăn', tone: 'good' })
  if (job.recruitmentType === 'direct') out.push({ key: 'rt', label: RECRUITMENT_LABELS.direct, tone: 'good' })
  if (job.recruitmentType === 'agency') out.push({ key: 'rt', label: RECRUITMENT_LABELS.agency, tone: 'warn' })
  if (job.immediateStart === true) out.push({ key: 'now', label: 'Đi làm ngay', tone: 'neutral' })
  if (job.workSchedule) out.push({ key: 'sched', label: SCHEDULE_LABELS[job.workSchedule], tone: 'neutral' })
  if (job.weekendWork === true) out.push({ key: 'weekend', label: 'Làm cuối tuần', tone: 'neutral' })
  return out
}

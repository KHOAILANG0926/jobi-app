import type { KoreaJob } from '../types/koreaJob'

const SALARY_UNIT: Record<string, string> = {
  hourly: '/giờ', daily: '/ngày', monthly: '/tháng', annual: '/năm',
}

/** salary_min/max가 있으면 구조화된 값을 우선 쓰고, 없으면 원문 salary로 fallback. */
export function formatKoreaSalary(job: Pick<KoreaJob, 'salary' | 'salary_min' | 'salary_max' | 'salary_type'>): string | null {
  if (job.salary_min != null || job.salary_max != null) {
    const unit = job.salary_type ? SALARY_UNIT[job.salary_type] ?? '' : ''
    const min = job.salary_min != null ? job.salary_min.toLocaleString('ko-KR') : null
    const max = job.salary_max != null ? job.salary_max.toLocaleString('ko-KR') : null
    if (min && max && min !== max) return `${min} - ${max} KRW${unit}`
    if (min || max) return `${min ?? max} KRW${unit}`
  }
  return job.salary
}

export function koreaJobDisplayTitle(job: Pick<KoreaJob, 'title' | 'title_vi'>): string | null {
  return job.title_vi || job.title
}

export function koreaJobDisplayDescription(job: Pick<KoreaJob, 'description' | 'description_vi'>): string | null {
  return job.description_vi || job.description
}

export function koreaJobDisplayLocation(job: Pick<KoreaJob, 'province' | 'district' | 'region'>): string | null {
  return job.province ? [job.province, job.district].filter(Boolean).join(' ') : job.region
}

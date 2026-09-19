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

// local_jobs.id와 korea_jobs.id는 서로 다른 bigint 시퀀스라 같은 저장 목록에
// 그대로 섞으면 숫자가 우연히 겹칠 수 있다 — "저장한 공고"(storage.ts,
// vgb_saved_job_ids)는 두 출처를 구분 없이 문자열 id 하나로 저장하므로,
// korea_jobs 쪽만 이 접두사를 붙여 저장한다.
const KOREA_SAVED_ID_PREFIX = 'kr-'

export function koreaSavedId(jobId: number): string {
  return `${KOREA_SAVED_ID_PREFIX}${jobId}`
}

/** "kr-123" -> 123, 접두사가 없으면(로컬 공고 id) null. */
export function parseKoreaSavedId(savedId: string): number | null {
  if (!savedId.startsWith(KOREA_SAVED_ID_PREFIX)) return null
  const n = Number(savedId.slice(KOREA_SAVED_ID_PREFIX.length))
  return Number.isFinite(n) ? n : null
}

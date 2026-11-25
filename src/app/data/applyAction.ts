import { resolveApplyAction, zaloMeUrl, type ApplyAction } from '../../lib/jobUtils'
import type { Job } from '../../types/job'

/** 카드·지도 카드·상세 하단 바가 모두 쓰는 지원 버튼 판정 1개 — 기존 resolveApplyAction(웹 목록·상세와 같은 기준)을 그대로 따른다.
 *  internal = 사이트 안 지원(기업 계정 공고, 로그인 필요) / contact = 공고에 적힌 전화·Zalo만 보여 줌 / none = 버튼 없음.
 *  원본 채용사이트로 보내는 동작은 어떤 경우에도 만들지 않는다. */
export interface AppApplyButton { kind: ApplyAction; label: string; href?: string }

export function appApplyButton(job: Partial<Pick<Job, 'employerId' | 'employerPhone' | 'zalo'>>): AppApplyButton {
  const kind = resolveApplyAction(job as Pick<Job, 'employerId' | 'employerPhone' | 'zalo'>)
  if (kind === 'internal') return { kind, label: 'Ứng tuyển' }
  if (kind === 'contact') {
    const phone = job.employerPhone?.trim()
    if (phone) return { kind, label: 'Gọi', href: `tel:${phone.replace(/\s/g, '')}` }
    const zalo = job.zalo?.trim()
    return { kind, label: 'Zalo', href: zaloMeUrl(zalo ?? '') }
  }
  return { kind: 'none', label: '' }
}

/**
 * 메인 카드 사진 고르기 — 한 곳에서만 정한다(PC 바둑판·모바일 밀기 칸 모두 이 함수).
 * Lee 2026-11-01 사람인 방식: 사진 없는 공고는 업종에 맞는 대표 사진으로 대신(표시 없음).
 * 순서: ① 공고 포스터(우리 저장소) ② 업종 대표 사진(public/images/industry, 출처 data/industry-photos/SOURCES.json).
 */
import type { Job, JobCategory } from '../types/job'
import { companyLogoUrl } from './companyLogo'

const INDUSTRY: Record<JobCategory, true> = {
  am_thuc_do_uong: true, quan_ly_ban_hang: true, dich_vu: true, van_phong: true, cskh_kinh_doanh: true,
  san_xuat_xay_dung: true, cntt_ky_thuat: true, thiet_ke: true, truyen_thong: true, lai_xe_giao_hang: true,
  y_te_dieu_duong: true, giao_duc_giang_day: true, khac: true,
}

export function industryPhotoUrl(category: JobCategory | undefined): string {
  return `/images/industry/${category && INDUSTRY[category] ? category : 'khac'}.jpg`
}

export function cardPhoto(job: Pick<Job, 'imageUrl' | 'category'>): { url: string; kind: 'poster' | 'industry' } {
  const poster = companyLogoUrl(job.imageUrl)
  return poster ? { url: poster, kind: 'poster' } : { url: industryPhotoUrl(job.category), kind: 'industry' }
}

/** 사진 위 왼쪽 꼬리표 — 특별 기준 항목(기숙사·통근버스·식사). 없으면 빈 배열. */
export function benefitTags(job: Pick<Job, 'dormitory' | 'shuttleBus' | 'mealProvided'>): string[] {
  return [job.dormitory && 'Ký túc xá', job.shuttleBus && 'Xe đưa đón', job.mealProvided && 'Bao ăn']
    .filter((v): v is string => !!v)
}

/** 마감 표시: 날짜면 "~15/11", 상시면 "Thường xuyên", 없으면 null. */
export function deadlineLabel(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `~${Number(m[3])}/${Number(m[2])}`
  return /thường xuyên|liên tục|không thời hạn/i.test(s) ? 'Thường xuyên' : null
}

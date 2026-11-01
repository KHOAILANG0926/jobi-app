/**
 * 업종 대표 사진 — Lee 2026-11-01(사람인 방식), 2026-11-02 정정: 카드 틀은 그대로 두고
 * 로고·포스터가 없을 때 비는 로고 자리만 업종 사진으로 채운다(표시 없음).
 * 사진: public/images/industry/<업종>.jpg, 출처·저작자·라이선스: data/industry-photos/SOURCES.json.
 */
import type { JobCategory } from '../types/job'

const INDUSTRY: Record<JobCategory, true> = {
  am_thuc_do_uong: true, quan_ly_ban_hang: true, dich_vu: true, van_phong: true, cskh_kinh_doanh: true,
  san_xuat_xay_dung: true, cntt_ky_thuat: true, thiet_ke: true, truyen_thong: true, lai_xe_giao_hang: true,
  y_te_dieu_duong: true, giao_duc_giang_day: true, khac: true,
}

// 음식 업종은 카페와 식당 사진을 나눈다(Lee 2026-11-02 "보문뜰은 식당이야").
const CAFE_SUB = new Set(['barista', 'quan_ca_phe', 'kem_trang_mieng', 'tiem_banh', 'tho_lam_banh'])
const NUONG_WORDS = /nướng|bbq|barbecue|barbeque/iu
const LAU_WORDS = /\blẩu\b|hot\s*pot|hotpot/iu
const CAFE_WORDS = /cà\s*phê|ca\s*phe|coffee|caf[eé]|trà\s*sữa|barista|pha\s*chế/iu

export function industryPhotoUrl(category: string | null | undefined, subcategory?: string | null, text?: string | null): string {
  if (category === 'am_thuc_do_uong') {
    const cafe = (subcategory && CAFE_SUB.has(subcategory)) || CAFE_WORDS.test(text ?? '')
    if (cafe) return '/images/industry/am_thuc_do_uong.jpg'
    // 식당은 공고에 적힌 식당 종류 낱말로 고른다(Lee 2026-11-02: 한국 고깃집에 중국 연회장 사진 금지). 없으면 나라 느낌 없는 일반 식당.
    const t = text ?? ''
    if (NUONG_WORDS.test(t)) return '/images/industry/nha_hang_nuong.jpg'
    if (LAU_WORDS.test(t)) return '/images/industry/nha_hang_lau.jpg'
    return '/images/industry/nha_hang_chung.jpg'
  }
  return `/images/industry/${category && category in INDUSTRY ? category : 'khac'}.jpg`
}

import { VN_PROVINCES } from './vnProvinces'
import { provinceShortName } from '../lib/jobArea'

/** 메뉴 "Theo khu vực" — 알바몬 "지역별 알바정보"처럼 공식 34개 성 전부(Lee 2026-11-03
 * "지역은 확대니까 지금 없다고 안 만들면 안 돼"). PC·모바일 메뉴가 같은 목록을 쓴다. */
export const REGION_MENU_LINKS: { label: string; to: string }[] = [
  { label: 'Tất cả khu vực', to: '/viec-lam/khu-vuc' },
  ...VN_PROVINCES.map((p) => ({ label: provinceShortName(p), to: `/viec-lam/khu-vuc?province=${encodeURIComponent(p)}` })),
]

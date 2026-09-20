import type { JobCategory } from '../types/job'

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  am_thuc_do_uong:    'Ẩm thực · Đồ uống',
  quan_ly_ban_hang:   'Quản lý cửa hàng · Bán hàng',
  dich_vu:            'Dịch vụ',
  van_phong:          'Văn phòng',
  cskh_kinh_doanh:    'Chăm sóc khách hàng · Kinh doanh',
  san_xuat_xay_dung:  'Sản xuất · Xây dựng · Lao động phổ thông',
  cntt_ky_thuat:      'CNTT · Kỹ thuật',
  thiet_ke:           'Thiết kế',
  truyen_thong:       'Truyền thông',
  lai_xe_giao_hang:   'Lái xe · Giao hàng',
  y_te_dieu_duong:    'Y tế · Điều dưỡng · Nghiên cứu',
  giao_duc_giang_day: 'Giáo dục · Giảng dạy',
  khac:               'Khác',
}

export const CATEGORY_SHORT: Record<JobCategory, string> = {
  am_thuc_do_uong:    'Ẩm thực',
  quan_ly_ban_hang:   'Bán hàng',
  dich_vu:            'Dịch vụ',
  van_phong:          'Văn phòng',
  cskh_kinh_doanh:    'CSKH · KD',
  san_xuat_xay_dung:  'Sản xuất',
  cntt_ky_thuat:      'CNTT',
  thiet_ke:           'Thiết kế',
  truyen_thong:       'Truyền thông',
  lai_xe_giao_hang:   'Giao hàng',
  y_te_dieu_duong:    'Y tế',
  giao_duc_giang_day: 'Giáo dục',
  khac:               'Khác',
}

export const CATEGORY_ICONS: Record<JobCategory, string> = {
  am_thuc_do_uong:    '🍽️',
  quan_ly_ban_hang:   '🛍️',
  dich_vu:            '🛎️',
  van_phong:          '💼',
  cskh_kinh_doanh:    '📞',
  san_xuat_xay_dung:  '🏭',
  cntt_ky_thuat:      '💻',
  thiet_ke:           '🎨',
  truyen_thong:       '🎬',
  lai_xe_giao_hang:   '🛵',
  y_te_dieu_duong:    '🏥',
  giao_duc_giang_day: '📚',
  khac:               '✨',
}

export const CATEGORY_SOLID: Record<JobCategory | 'all', string> = {
  all:                '#ef4444',
  am_thuc_do_uong:    '#dc6b19',
  quan_ly_ban_hang:   '#8b5cf6',
  dich_vu:            '#10b981',
  van_phong:          '#0ea5e9',
  cskh_kinh_doanh:    '#f59e0b',
  san_xuat_xay_dung:  '#f97316',
  cntt_ky_thuat:      '#2563eb',
  thiet_ke:           '#d946ef',
  truyen_thong:       '#a855f7',
  lai_xe_giao_hang:   '#3b82f6',
  y_te_dieu_duong:    '#ef4444',
  giao_duc_giang_day: '#14b8a6',
  khac:               '#ec4899',
}

/** 2026-09-20 사용자 지시("쿠팡은 왼쪽 진한초록 오른쪽 초록 가운데 중간색,
 *  신세계는 초록→연두→진한노랑처럼 다른 색상까지 뚜렷하게 걸치는 그라데이션")
 *  — 같은 색 계열 밝기만 다른 2단 대신, 다른 색상까지 걸치는 3단 그라데이션. */
export const CATEGORY_COLORS: Record<JobCategory | 'all', string> = {
  all:                'linear-gradient(135deg,#dc2626,#f97316,#facc15)',
  am_thuc_do_uong:    'linear-gradient(135deg,#7c2d12,#ea580c,#fbbf24)',
  quan_ly_ban_hang:   'linear-gradient(135deg,#5b21b6,#a855f7,#f0abfc)',
  dich_vu:            'linear-gradient(135deg,#065f46,#10b981,#a3e635)',
  van_phong:          'linear-gradient(135deg,#1e3a8a,#0ea5e9,#67e8f9)',
  cskh_kinh_doanh:    'linear-gradient(135deg,#92400e,#f59e0b,#fde047)',
  san_xuat_xay_dung:  'linear-gradient(135deg,#c2410c,#f97316,#fde047)',
  cntt_ky_thuat:      'linear-gradient(135deg,#1e3a8a,#3b82f6,#7dd3fc)',
  thiet_ke:           'linear-gradient(135deg,#86198f,#d946ef,#f9a8d4)',
  truyen_thong:       'linear-gradient(135deg,#5b21b6,#8b5cf6,#f0abfc)',
  lai_xe_giao_hang:   'linear-gradient(135deg,#1e40af,#3b82f6,#5eead4)',
  y_te_dieu_duong:    'linear-gradient(135deg,#991b1b,#ef4444,#fda4af)',
  giao_duc_giang_day: 'linear-gradient(135deg,#115e59,#14b8a6,#bef264)',
  khac:               'linear-gradient(135deg,#9d174d,#ec4899,#fda4af)',
}

export const ALL_CATEGORIES: JobCategory[] = [
  'am_thuc_do_uong',
  'quan_ly_ban_hang',
  'dich_vu',
  'van_phong',
  'cskh_kinh_doanh',
  'san_xuat_xay_dung',
  'cntt_ky_thuat',
  'thiet_ke',
  'truyen_thong',
  'lai_xe_giao_hang',
  'y_te_dieu_duong',
  'giao_duc_giang_day',
  'khac',
]

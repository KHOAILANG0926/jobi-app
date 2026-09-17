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

export const CATEGORY_COLORS: Record<JobCategory | 'all', string> = {
  all:                'linear-gradient(135deg,#ef4444,#f97316)',
  am_thuc_do_uong:    'linear-gradient(135deg,#9a3412,#dc6b19)',
  quan_ly_ban_hang:   'linear-gradient(135deg,#6d28d9,#a78bfa)',
  dich_vu:            'linear-gradient(135deg,#065f46,#10b981)',
  van_phong:          'linear-gradient(135deg,#0369a1,#0ea5e9)',
  cskh_kinh_doanh:    'linear-gradient(135deg,#b45309,#f59e0b)',
  san_xuat_xay_dung:  'linear-gradient(135deg,#f97316,#fb923c)',
  cntt_ky_thuat:      'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  thiet_ke:           'linear-gradient(135deg,#a21caf,#e879f9)',
  truyen_thong:       'linear-gradient(135deg,#7e22ce,#c084fc)',
  lai_xe_giao_hang:   'linear-gradient(135deg,#1d4ed8,#60a5fa)',
  y_te_dieu_duong:    'linear-gradient(135deg,#b91c1c,#f87171)',
  giao_duc_giang_day: 'linear-gradient(135deg,#0f766e,#2dd4bf)',
  khac:               'linear-gradient(135deg,#be185d,#ec4899)',
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

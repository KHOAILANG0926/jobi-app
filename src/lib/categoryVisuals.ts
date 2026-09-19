export interface CategoryVisual {
  imageUrl: string
  label: string
}

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  am_thuc_do_uong: {
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    label: 'ẨM THỰC / ĐỒ UỐNG',
  },
  quan_ly_ban_hang: {
    imageUrl: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=600&q=80',
    label: 'QUẢN LÝ CỬA HÀNG / BÁN HÀNG',
  },
  dich_vu: {
    imageUrl: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=80',
    label: 'DỊCH VỤ',
  },
  van_phong: {
    imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&q=80',
    label: 'VĂN PHÒNG',
  },
  cskh_kinh_doanh: {
    imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&q=80',
    label: 'CHĂM SÓC KHÁCH HÀNG / KINH DOANH',
  },
  san_xuat_xay_dung: {
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80',
    label: 'SẢN XUẤT / XÂY DỰNG',
  },
  lai_xe_giao_hang: {
    imageUrl: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=600&q=80',
    label: 'LÁI XE / GIAO HÀNG',
  },
  cntt_ky_thuat: {
    imageUrl: 'https://images.unsplash.com/photo-1604754742629-3e5728249d73?w=600&q=80',
    label: 'CNTT · KỸ THUẬT',
  },
  thiet_ke: {
    imageUrl: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=600&q=80',
    label: 'THIẾT KẾ',
  },
  truyen_thong: {
    imageUrl: 'https://images.unsplash.com/photo-1612544409025-e1f6a56c1152?w=600&q=80',
    label: 'TRUYỀN THÔNG',
  },
  y_te_dieu_duong: {
    imageUrl: 'https://images.unsplash.com/photo-1691139601099-932c01ec198b?w=600&q=80',
    label: 'Y TẾ · ĐIỀU DƯỠNG · NGHIÊN CỨU',
  },
  giao_duc_giang_day: {
    imageUrl: 'https://images.unsplash.com/photo-1511629091441-ee46146481b6?w=600&q=80',
    label: 'GIÁO DỤC · GIẢNG DẠY',
  },
  khac: {
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80',
    label: 'VIỆC LÀM',
  },
}

export function getCategoryVisual(category: string): CategoryVisual {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.khac
}

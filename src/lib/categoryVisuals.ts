export interface CategoryVisual {
  imageUrl: string
  label: string
}

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  cafe: {
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&q=80',
    label: 'QUÁN CÀ PHÊ',
  },
  restaurant: {
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    label: 'NHÀ HÀNG / ẨM THỰC',
  },
  factory: {
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80',
    label: 'NHÀ MÁY / SẢN XUẤT',
  },
  delivery: {
    imageUrl: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=600&q=80',
    label: 'GIAO HÀNG / VẬN CHUYỂN',
  },
  cleaning: {
    imageUrl: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=80',
    label: 'VỆ SINH / TẠP VỤ',
  },
  retail: {
    imageUrl: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=600&q=80',
    label: 'BÁN LẺ / CỬA HÀNG',
  },
  office: {
    imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&q=80',
    label: 'VĂN PHÒNG / TƯ VẤN',
  },
  other: {
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80',
    label: 'VIỆC LÀM',
  },
}

export function getCategoryVisual(category: string): CategoryVisual {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.other
}

import type { JobCategory } from '../types/job'

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  factory:    'Nhà máy / Công nghiệp',
  cafe:       'Quán cà phê',
  restaurant: 'Nhà hàng / Ẩm thực',
  delivery:   'Giao hàng',
  cleaning:   'Vệ sinh / Giúp việc',
  retail:     'Bán lẻ',
  other:      'Khác',
}

export const CATEGORY_SHORT: Record<JobCategory, string> = {
  factory:    'Nhà máy',
  cafe:       'Cafe',
  restaurant: 'Nhà hàng',
  delivery:   'Giao hàng',
  cleaning:   'Vệ sinh',
  retail:     'Bán lẻ',
  other:      'Khác',
}

export const CATEGORY_ICONS: Record<JobCategory, string> = {
  factory:    '🏭',
  cafe:       '☕',
  restaurant: '🍽️',
  delivery:   '🛵',
  cleaning:   '🧹',
  retail:     '🛍️',
  other:      '✨',
}

export const CATEGORY_SOLID: Record<JobCategory | 'all', string> = {
  all:        '#ef4444',
  factory:    '#f97316',
  cafe:       '#b45309',
  restaurant: '#dc6b19',
  delivery:   '#3b82f6',
  cleaning:   '#10b981',
  retail:     '#8b5cf6',
  other:      '#ec4899',
}

export const CATEGORY_COLORS: Record<JobCategory | 'all', string> = {
  all:        'linear-gradient(135deg,#ef4444,#f97316)',
  factory:    'linear-gradient(135deg,#f97316,#fb923c)',
  cafe:       'linear-gradient(135deg,#7c2d12,#d97706)',
  restaurant: 'linear-gradient(135deg,#9a3412,#dc6b19)',
  delivery:   'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  cleaning:   'linear-gradient(135deg,#065f46,#10b981)',
  retail:     'linear-gradient(135deg,#6d28d9,#a78bfa)',
  other:      'linear-gradient(135deg,#be185d,#ec4899)',
}

export const ALL_CATEGORIES: JobCategory[] = [
  'factory',
  'cafe',
  'restaurant',
  'delivery',
  'cleaning',
  'retail',
  'other',
]

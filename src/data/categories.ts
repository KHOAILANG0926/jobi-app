import type { JobCategory } from '../types/job'

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  factory: 'Nhà máy / Công nghiệp',
  cafe: 'Quán cà phê / Nhà hàng',
  delivery: 'Giao hàng',
  cleaning: 'Vệ sinh / Giúp việc',
  retail: 'Bán lẻ',
  other: 'Khác',
}

export const CATEGORY_ICONS: Record<JobCategory, string> = {
  factory: '🏭',
  cafe: '☕',
  delivery: '🛵',
  cleaning: '🧹',
  retail: '🛍️',
  other: '✨',
}

export const ALL_CATEGORIES: JobCategory[] = [
  'factory',
  'cafe',
  'delivery',
  'cleaning',
  'retail',
  'other',
]

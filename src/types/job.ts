export type JobCategory =
  | 'factory'
  | 'cafe'
  | 'delivery'
  | 'cleaning'
  | 'retail'
  | 'other'

export interface Job {
  id: string
  title: string
  company: string
  category: JobCategory
  salary: string
  location: string
  description: string
  postedAt: string
  /** Số điện thoại nhà tuyển dụng (hiển thị & Zalo) */
  employerPhone: string
  /** Hạn nộp hồ sơ — ISO YYYY-MM-DD */
  applicationDeadline: string
  /** Tuyển gấp — badge đỏ */
  urgent?: boolean
  hours?: string
  /** Vĩ độ / kinh độ để hiển thị trên bản đồ (ước lượng theo địa điểm nếu thiếu) */
  lat?: number
  lng?: number
}

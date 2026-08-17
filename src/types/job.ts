export type JobCategory =
  | 'factory'
  | 'cafe'
  | 'restaurant'
  | 'delivery'
  | 'cleaning'
  | 'retail'
  | 'office'
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
  employerPhone: string
  zalo?: string
  applicationDeadline: string
  urgent?: boolean
  hours?: string
  employerId?: string
  lat?: number
  lng?: number
  imageUrl?: string
  images?: string[]
  source?: string
  workPeriod?: string
  workDays?: string
  education?: string
  preference?: string
  numHires?: string
  companyVerified?: boolean
  companyFoundedYear?: number
  hireCount?: number
}

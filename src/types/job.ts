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
  employerPhone: string
  applicationDeadline: string
  urgent?: boolean
  hours?: string
  employerId?: string
  lat?: number
  lng?: number
  imageUrl?: string
}

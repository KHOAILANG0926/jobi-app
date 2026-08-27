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
  /** Pre-fallback raw values (undefined if the source field was empty) — used where
   *  a field must be hidden rather than shown with injected placeholder text. */
  rawSalary?: string
  rawLocation?: string
  rawEducation?: string
  rawPreference?: string
  /** Coordinates as actually stored in the DB row — undefined when the row had none,
   *  unlike `lat`/`lng` which may be back-filled with a guessed province-level location. */
  rawLat?: number
  rawLng?: number
}

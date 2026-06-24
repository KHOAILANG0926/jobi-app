import type { CvData } from './cvStorage'

const CV_KEY = 'vgb_cv_draft'

/** True if the user has saved a CV in localStorage with minimum fields filled. */
export function hasSavedCv(): boolean {
  try {
    const raw = localStorage.getItem(CV_KEY)
    if (!raw) return false
    const cv = JSON.parse(raw) as Partial<CvData>
    return Boolean(
      typeof cv.fullName === 'string' &&
        cv.fullName.trim() &&
        typeof cv.phone === 'string' &&
        cv.phone.trim() &&
        typeof cv.email === 'string' &&
        cv.email.trim(),
    )
  } catch {
    return false
  }
}

import { normalizeViText } from './jobCoords'

export interface CompanyReview {
  id: string
  companyKey: string
  companyDisplay: string
  rating: number
  text: string
  reviewerKey: string
  createdAt: string
}

const KEY = 'vgb_company_reviews'

export function companyKeyFromName(company: string): string {
  return normalizeViText(company).replace(/\s+/g, ' ').trim() || company.trim()
}

function loadAll(): CompanyReview[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CompanyReview[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list: CompanyReview[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent('vgb:company-reviews'))
}

export function getReviewsForCompany(company: string): CompanyReview[] {
  const key = companyKeyFromName(company)
  return loadAll().filter((r) => r.companyKey === key)
}

export function getRecentReviewsForCompany(company: string, limit: number): CompanyReview[] {
  return [...getReviewsForCompany(company)]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function getCompanyRatingSummary(company: string): {
  average: number
  count: number
} {
  const list = getReviewsForCompany(company)
  if (list.length === 0) return { average: 0, count: 0 }
  const sum = list.reduce((s, r) => s + r.rating, 0)
  return { average: sum / list.length, count: list.length }
}

export function hasUserReviewedCompany(company: string, reviewerKey: string): boolean {
  const key = companyKeyFromName(company)
  return loadAll().some((r) => r.companyKey === key && r.reviewerKey === reviewerKey)
}

export function addCompanyReview(input: {
  companyDisplay: string
  rating: number
  text: string
  reviewerKey: string
}): { ok: true } | { ok: false; reason: 'duplicate' | 'invalid' } {
  const t = input.text.trim()
  if (input.rating < 1 || input.rating > 5 || !t) return { ok: false, reason: 'invalid' }
  const companyKey = companyKeyFromName(input.companyDisplay)
  if (hasUserReviewedCompany(input.companyDisplay, input.reviewerKey)) {
    return { ok: false, reason: 'duplicate' }
  }
  const review: CompanyReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    companyKey,
    companyDisplay: input.companyDisplay.trim(),
    rating: input.rating,
    text: t,
    reviewerKey: input.reviewerKey,
    createdAt: new Date().toISOString(),
  }
  persist([review, ...loadAll()])
  return { ok: true }
}
